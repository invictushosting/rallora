-- Partner invite and membership claim flow for approved team applications.
begin;

alter table public.rallora_player_profiles
  add column if not exists playtomic_rating numeric(4,2)
  check (playtomic_rating is null or playtomic_rating between 0 and 10);

create table if not exists public.rallora_team_member_invites (
  id uuid primary key default gen_random_uuid(),
  team_application_id uuid not null unique references public.rallora_team_applications(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  invited_name text not null check (char_length(trim(invited_name)) between 2 and 120),
  invited_email text not null check (char_length(trim(invited_email)) between 3 and 254),
  playtomic_rating numeric(4,2) check (playtomic_rating is null or playtomic_rating between 0 and 10),
  status text not null default 'pending' check (status in ('pending','claimed','cancelled')),
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.rallora_team_member_invites enable row level security;
revoke all on public.rallora_team_member_invites from public,anon;
grant select on public.rallora_team_member_invites to authenticated;

create policy "team_invite_manager_read" on public.rallora_team_member_invites
for select to authenticated using(public.rallora_can_manage_club(club_id));

create policy "team_invite_recipient_read" on public.rallora_team_member_invites
for select to authenticated using(
  lower(invited_email)=lower(coalesce(auth.jwt()->>'email',''))
);

alter table public.rallora_team_applications
  add column if not exists partner_invite_id uuid references public.rallora_team_member_invites(id) on delete set null;

create or replace function public.rallora_review_team_application(p_application_id uuid,p_decision text,p_division_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.rallora_team_applications%rowtype; v_team uuid; v_request uuid; v_invite uuid; v_slug text;
begin
 if p_decision not in ('approved','declined') then raise exception 'Invalid decision'; end if;
 select * into a from public.rallora_team_applications where id=p_application_id for update;
 if not found then raise exception 'Application not found'; end if;
 if not public.rallora_can_manage_club(a.club_id) then raise exception 'Not authorised'; end if;
 if a.status<>'pending' then raise exception 'Application already reviewed'; end if;

 if p_decision='approved' then
   if p_division_id is null or not exists(select 1 from public.divisions d where d.id=p_division_id and d.season_id=a.season_id) then
     raise exception 'Choose a valid division for this season';
   end if;
   if nullif(trim(a.partner_email),'') is null then
     raise exception 'Partner email is required before approving this team';
   end if;

   insert into public.teams(division_id,name,player_one_name,player_two_name,is_active)
   values(p_division_id,trim(a.team_name),trim(a.captain_name),trim(a.partner_name),true)
   returning id into v_team;

   insert into public.rallora_team_registration_requests(
     club_id,season_id,division_id,team_id,player_user_id,player_name,player_phone,status,reviewed_by,reviewed_at)
   values(a.club_id,a.season_id,p_division_id,v_team,a.requested_by,a.captain_name,a.captain_phone,'approved',auth.uid(),now())
   returning id into v_request;

   insert into public.rallora_team_roster_memberships(
     registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role,approved_by)
   values(v_request,a.club_id,a.season_id,p_division_id,v_team,a.requested_by,'captain',auth.uid())
   on conflict(team_id,player_user_id) do update set role='captain';

   update public.rallora_player_profiles
   set playtomic_rating=a.captain_playtomic_rating,updated_at=now()
   where user_id=a.requested_by;

   insert into public.rallora_team_member_invites(
     team_application_id,club_id,season_id,division_id,team_id,invited_name,invited_email,playtomic_rating)
   values(a.id,a.club_id,a.season_id,p_division_id,v_team,trim(a.partner_name),lower(trim(a.partner_email)),a.partner_playtomic_rating)
   returning id into v_invite;

   select c.slug into v_slug from public.clubs c where c.id=a.club_id;
   insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url)
   values(a.requested_by,a.club_id,'team_approved','Your team has been approved',
     trim(a.team_name)||' is live. Your captain access is ready.',
     '/clubs/'||v_slug||'/captain');
 end if;

 update public.rallora_team_applications
 set status=p_decision,
     division_id=case when p_decision='approved' then p_division_id else division_id end,
     reviewed_by=auth.uid(),reviewed_at=now(),created_team_id=v_team,partner_invite_id=v_invite,updated_at=now()
 where id=a.id;
 return v_team;
end $$;

create or replace function public.rallora_claim_team_invite(p_invite_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.rallora_team_member_invites%rowtype; v_request uuid; v_email text;
begin
 if auth.uid() is null then raise exception 'Sign in to claim this team place'; end if;
 v_email:=lower(coalesce(auth.jwt()->>'email',''));
 if v_email='' then raise exception 'Your account does not have an email address'; end if;

 select * into i from public.rallora_team_member_invites where id=p_invite_id for update;
 if not found then raise exception 'Invite not found'; end if;
 if i.status<>'pending' then raise exception 'This invite has already been used'; end if;
 if lower(i.invited_email)<>v_email then raise exception 'Sign in with the email address that was invited'; end if;

 insert into public.rallora_player_profiles(user_id,display_name,playtomic_rating,updated_at)
 values(auth.uid(),i.invited_name,i.playtomic_rating,now())
 on conflict(user_id) do update set
   display_name=excluded.display_name,
   playtomic_rating=coalesce(excluded.playtomic_rating,public.rallora_player_profiles.playtomic_rating),
   updated_at=now();

 insert into public.rallora_team_registration_requests(
   club_id,season_id,division_id,team_id,player_user_id,player_name,status,reviewed_at)
 values(i.club_id,i.season_id,i.division_id,i.team_id,auth.uid(),i.invited_name,'approved',now())
 returning id into v_request;

 insert into public.rallora_team_roster_memberships(
   registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role)
 values(v_request,i.club_id,i.season_id,i.division_id,i.team_id,auth.uid(),'player')
 on conflict(team_id,player_user_id) do nothing;

 update public.rallora_team_member_invites
 set status='claimed',claimed_by=auth.uid(),claimed_at=now()
 where id=i.id;

 return i.team_id;
end $$;

revoke all on function public.rallora_review_team_application(uuid,text,uuid),public.rallora_claim_team_invite(uuid) from public,anon;
grant execute on function public.rallora_review_team_application(uuid,text,uuid),public.rallora_claim_team_invite(uuid) to authenticated;

commit;