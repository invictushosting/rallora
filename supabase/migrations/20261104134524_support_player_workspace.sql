-- Additive support workspace. No league, roster or registration records are changed.
alter table public.rallora_support_requests
 add column season_id uuid references public.seasons(id) on delete set null,
 add column diagnostics jsonb not null default '{}'::jsonb,
 add column screenshot_path text,
 add column reply_token uuid not null default gen_random_uuid() unique;

create table public.rallora_support_activities (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.rallora_support_requests(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 actor_label text not null,
 kind text not null,
 detail text not null,
 created_at timestamptz not null default now()
);
create index on public.rallora_support_activities(ticket_id,created_at);
alter table public.rallora_support_activities enable row level security;
revoke all on public.rallora_support_activities from anon,authenticated;
grant select on public.rallora_support_activities to authenticated;
create policy "support admins read activity" on public.rallora_support_activities for select to authenticated
 using (exists(select 1 from public.rallora_platform_admins where user_id=(select auth.uid())));

create table public.rallora_support_messages (
 id uuid primary key,
 ticket_id uuid not null references public.rallora_support_requests(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 actor_label text not null,
 direction text not null check(direction in ('outbound','inbound','invitation')),
 body text not null check(length(body) between 1 and 10000),
 recipient text not null,
 delivery_status text not null default 'pending' check(delivery_status in ('pending','accepted','failed','received')),
 provider_id text unique,
 created_at timestamptz not null default now()
);
create index on public.rallora_support_messages(ticket_id,created_at);
alter table public.rallora_support_messages enable row level security;
revoke all on public.rallora_support_messages from anon,authenticated;
grant select,insert,update on public.rallora_support_messages to authenticated;
create policy "support admins read messages" on public.rallora_support_messages for select to authenticated
 using (exists(select 1 from public.rallora_platform_admins where user_id=(select auth.uid())));
create policy "support admins create messages" on public.rallora_support_messages for insert to authenticated
 with check (actor_id=(select auth.uid()) and direction in ('outbound','invitation') and exists(select 1 from public.rallora_platform_admins where user_id=(select auth.uid())));
create policy "support admins update own messages" on public.rallora_support_messages for update to authenticated
 using (actor_id=(select auth.uid()) and exists(select 1 from public.rallora_platform_admins where user_id=(select auth.uid())))
 with check (actor_id=(select auth.uid()) and direction in ('outbound','invitation') and exists(select 1 from public.rallora_platform_admins where user_id=(select auth.uid())));

alter table public.rallora_support_requests drop constraint rallora_support_requests_category_check;
alter table public.rallora_support_requests add constraint rallora_support_requests_category_check
 check(category in ('bug','general_help','registration','billing','feature_request','other','login','match_chat','results'));

-- Trigger functions are private and cannot be called through the Data API.
create schema if not exists rallora_private;
revoke all on schema rallora_private from public,anon,authenticated;
create function rallora_private.audit_support_ticket() returns trigger language plpgsql security definer set search_path='' as $$
declare actor text; detail text;
begin
 select email into actor from auth.users where id=auth.uid();
 if TG_OP='INSERT' then detail := 'Ticket created';
 else
  detail := concat_ws('; ',case when new.status is distinct from old.status then 'Status: '||old.status||' → '||new.status end,
   case when new.priority is distinct from old.priority then 'Priority: '||old.priority||' → '||new.priority end,
   case when new.assignee is distinct from old.assignee then 'Assigned to: '||coalesce(new.assignee,'Unassigned') end,
   case when new.internal_notes is distinct from old.internal_notes then 'Internal notes updated' end);
 end if;
 if detail<>'' then insert into public.rallora_support_activities(ticket_id,actor_id,actor_label,kind,detail)
 values(new.id,auth.uid(),coalesce(actor,'Email / system'),'ticket',detail); end if;
 return new;
end $$;
revoke all on function rallora_private.audit_support_ticket() from public,anon,authenticated;
create trigger support_ticket_audit after insert or update on public.rallora_support_requests for each row execute function rallora_private.audit_support_ticket();

-- Deliberately narrow privileged lookup: auth account fields are never exposed to players.
create function public.rallora_support_player_lookup(p_query text,p_exact boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; q text := lower(trim(p_query));
begin
 if auth.uid() is null or not exists(select 1 from public.rallora_platform_admins where user_id=auth.uid()) then raise exception 'Platform admin access required' using errcode='42501'; end if;
 if length(q)<3 or length(q)>254 then return '[]'::jsonb; end if;
 with candidates as (
  select lower(u.email) as email from auth.users u left join public.rallora_player_profiles p on p.user_id=u.id
  where (p_exact and (lower(u.email)=q or lower(p.playtomic_email)=q)) or
   (not p_exact and (strpos(lower(u.email),q)>0 or strpos(lower(p.display_name),q)>0 or strpos(lower(p.playtomic_email),q)>0))
  union
  select lower(i.invited_email) from public.rallora_team_member_invites i
  where (p_exact and lower(i.invited_email)=q) or (not p_exact and (strpos(lower(i.invited_email),q)>0 or strpos(lower(i.invited_name),q)>0))
 ), selected as (select email from candidates where email is not null order by email limit 20)
 select coalesce(jsonb_agg(jsonb_build_object(
  'email',c.email,'userId',u.id,'name',coalesce(p.display_name,(select invited_name from public.rallora_team_member_invites where lower(invited_email)=c.email order by created_at desc limit 1)),
  'confirmedAt',u.email_confirmed_at,'lastSignIn',u.last_sign_in_at,'playtomicEmail',p.playtomic_email,
  'teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'active',t.is_active,'players',concat_ws(' / ',t.player_one_name,t.player_two_name),'division',d.name,'season',s.name,'seasonId',s.id,'club',cl.name,'slug',cl.slug,
    'hasAccess',exists(select 1 from public.rallora_team_roster_memberships m where m.team_id=t.id and m.player_user_id=u.id),
    'fixtures',(select count(*) from public.fixtures f where (f.home_team_id=t.id or f.away_team_id=t.id) and f.status<>'cancelled'),
    'openFixtures',(select count(*) from public.fixtures f where (f.home_team_id=t.id or f.away_team_id=t.id) and f.status='open' and (f.available_from is null or f.available_from<=current_date))
   )) from public.teams t join public.divisions d on d.id=t.division_id join public.seasons s on s.id=d.season_id join public.clubs cl on cl.id=s.club_id
   where exists(select 1 from public.rallora_team_roster_memberships m where m.team_id=t.id and m.player_user_id=u.id)
    or exists(select 1 from public.rallora_team_member_invites i where i.team_id=t.id and lower(i.invited_email)=c.email and i.status in ('pending','claimed'))
    or lower(t.player_one_email)=c.email or lower(t.player_two_email)=c.email
    or exists(select 1 from public.rallora_team_applications a where a.created_team_id=t.id and a.requested_by=u.id and a.status='approved')
  ),'[]'::jsonb),
  'invites',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'status',i.status,'claimedAt',i.claimed_at,'teamId',i.team_id,'club',cl.name,'slug',cl.slug,'season',s.name)) from public.rallora_team_member_invites i join public.clubs cl on cl.id=i.club_id join public.seasons s on s.id=i.season_id where lower(i.invited_email)=c.email),'[]'::jsonb),
  'registrations',coalesce((select jsonb_agg(jsonb_build_object('status',a.status,'captain',a.captain_name,'partner',a.partner_name,'season',s.name,'club',cl.name,'slug',cl.slug)) from public.rallora_team_applications a join public.seasons s on s.id=a.season_id join public.clubs cl on cl.id=a.club_id where a.requested_by=u.id or lower(a.partner_email)=c.email),'[]'::jsonb)
 )), '[]'::jsonb) into result from selected c left join auth.users u on lower(u.email)=c.email left join public.rallora_player_profiles p on p.user_id=u.id;
 return result;
end $$;
revoke all on function public.rallora_support_player_lookup(text,boolean) from public,anon;
grant execute on function public.rallora_support_player_lookup(text,boolean) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('support-screenshots','support-screenshots',false,5242880,array['image/png','image/jpeg','image/webp']);
create policy "players upload support screenshot" on storage.objects for insert to authenticated
 with check(bucket_id='support-screenshots' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "support admins view screenshots" on storage.objects for select to authenticated
 using(bucket_id='support-screenshots' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.rallora_platform_admins where user_id=(select auth.uid()))));

create policy "players remove own support uploads" on storage.objects for delete to authenticated
 using(bucket_id='support-screenshots' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Atomically append and reopen exactly once. Callable only with the server service role.
create function public.rallora_support_receive_reply(p_token uuid,p_provider_id text,p_sender text,p_body text)
returns text language plpgsql security invoker set search_path='' as $$
declare ticket public.rallora_support_requests; inserted uuid;
begin
 select * into ticket from public.rallora_support_requests where reply_token=p_token and lower(requester_email)=lower(p_sender) for update;
 if not found then return 'unmatched'; end if;
 insert into public.rallora_support_messages(id,ticket_id,actor_label,direction,body,recipient,delivery_status,provider_id)
 values(gen_random_uuid(),ticket.id,p_sender,'inbound',p_body,'support@rallora.app','received',p_provider_id)
 on conflict(provider_id) do nothing returning id into inserted;
 if inserted is null then return 'duplicate'; end if;
 update public.rallora_support_requests set status='in_progress',updated_at=now() where id=ticket.id;
 return 'received';
end $$;
revoke all on function public.rallora_support_receive_reply(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.rallora_support_receive_reply(uuid,text,text,text) to service_role;
grant all on public.rallora_support_messages,public.rallora_support_activities to service_role;
