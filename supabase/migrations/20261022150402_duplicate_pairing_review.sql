begin;
alter table public.rallora_team_applications
  add column duplicate_of uuid references public.rallora_team_applications(id);
alter table public.rallora_team_applications drop constraint rallora_team_applications_status_check;
alter table public.rallora_team_applications add constraint rallora_team_applications_status_check
  check(status in ('pending','approved','declined','withdrawn','duplicate'));
alter table public.rallora_team_applications add constraint duplicate_application_link_check
  check((status='duplicate')=(duplicate_of is not null) and duplicate_of is distinct from id);
create index rallora_application_duplicate_of_idx on public.rallora_team_applications(duplicate_of) where duplicate_of is not null;

-- Emails are compared in either player order. Names alone are advisory evidence.
create function rallora_private.registration_duplicates(p_club_id uuid,p_season_id uuid default null)
returns table(application_id uuid,matching_id uuid,confidence text,matching_status text)
language sql volatile security definer set search_path='' as $$
 with entries as (
  select a.id,a.season_id,a.requested_by,a.status,
   array_remove(array[nullif(lower(trim(u.email)),''),nullif(lower(trim(p.playtomic_email)),'')],null) as captain_emails,
   array_remove(array[nullif(lower(trim(a.partner_email)),''),nullif(lower(trim(a.partner_playtomic_email)),'')],null) as partner_emails,
   lower(regexp_replace(trim(a.captain_name),'[[:space:]]+',' ','g')) as captain_name,
   lower(regexp_replace(trim(a.partner_name),'[[:space:]]+',' ','g')) as partner_name
  from public.rallora_team_applications a
  join auth.users u on u.id=a.requested_by
  left join public.rallora_player_profiles p on p.user_id=a.requested_by
  where a.club_id=p_club_id and (p_season_id is null or a.season_id=p_season_id) and a.status in ('pending','approved')
 ), matches as (
  select a.id,b.id as matching_id,b.status,
   ((a.captain_emails && b.captain_emails and a.partner_emails && b.partner_emails)
    or (a.captain_emails && b.partner_emails and a.partner_emails && b.captain_emails)) as email_match,
   ((a.captain_name=b.captain_name and a.partner_name=b.partner_name)
    or (a.captain_name=b.partner_name and a.partner_name=b.captain_name)) as name_match
  from entries a join entries b on b.season_id=a.season_id and b.id<>a.id
 ) select id,matching_id,case when email_match then 'email' else 'name' end,status from matches where email_match or name_match;
$$;
revoke all on function rallora_private.registration_duplicates(uuid,uuid) from public,anon,authenticated;

create function public.rallora_registration_duplicates(p_club_id uuid)
returns table(application_id uuid,matching_id uuid,confidence text,matching_status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.rallora_can_manage_club(p_club_id) then raise exception 'Not authorised'; end if;
 return query select * from rallora_private.registration_duplicates(p_club_id);
end $$;
revoke all on function public.rallora_registration_duplicates(uuid) from public,anon;
grant execute on function public.rallora_registration_duplicates(uuid) to authenticated;

create or replace function public.rallora_review_team_application(p_application_id uuid,p_decision text,p_division_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.rallora_team_applications%rowtype; v_team uuid; v_request uuid; v_invite uuid; v_slug text; v_season uuid; v_club uuid;
begin
 select season_id,club_id into v_season,v_club from public.rallora_team_applications where id=p_application_id;
 if v_season is null then raise exception 'Application not found'; end if;
 if auth.uid() is null or not public.rallora_can_manage_club(v_club) then raise exception 'Not authorised'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_season::text,0));
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


-- Serialize approvals in a competition, including direct status updates.
create function rallora_private.guard_duplicate_approval() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='approved' and (tg_op='INSERT' or old.status is distinct from new.status) then
  perform pg_advisory_xact_lock(hashtextextended(new.season_id::text,0));
  if tg_op='INSERT' then raise exception 'Submit the application before approval'; end if;
  if exists(select 1 from rallora_private.registration_duplicates(new.club_id,new.season_id) d
    where d.application_id=new.id and d.confidence='email' and d.matching_status='approved') then
   raise exception 'This pairing is already approved in this competition. Close this application as a duplicate.';
  end if;
 end if;
 return new;
end $$;
revoke all on function rallora_private.guard_duplicate_approval() from public,anon,authenticated;
create trigger guard_duplicate_approval before insert or update of status on public.rallora_team_applications
 for each row execute function rallora_private.guard_duplicate_approval();

create function public.rallora_close_duplicate_application(p_application_id uuid,p_keep_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare a public.rallora_team_applications%rowtype; kept public.rallora_team_applications%rowtype; slug text; message text;
begin
 select * into a from public.rallora_team_applications where id=p_application_id;
 if not found then raise exception 'Application not found'; end if;
 if auth.uid() is null or not public.rallora_can_manage_club(a.club_id) then raise exception 'Not authorised'; end if;
 perform pg_advisory_xact_lock(hashtextextended(a.season_id::text,0));
 perform id from public.rallora_team_applications where id in (p_application_id,p_keep_id) order by id for update;
 select * into a from public.rallora_team_applications where id=p_application_id;
 select * into kept from public.rallora_team_applications where id=p_keep_id;
 if kept.id is null or kept.id=a.id or kept.club_id<>a.club_id or kept.season_id<>a.season_id
    or a.status<>'pending' or kept.status not in ('pending','approved') then
  raise exception 'Choose another pending or approved entry for the same pairing in this competition';
 end if;
 if not exists(select 1 from rallora_private.registration_duplicates(a.club_id,a.season_id) d where d.application_id=a.id and d.matching_id=kept.id) then
  raise exception 'These applications do not match. Review the player details first';
 end if;
 update public.rallora_team_applications set status='duplicate',duplicate_of=kept.id,
   reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now(),organiser_note='Closed as duplicate; retained application: '||kept.id where id=a.id;
 select c.slug into slug from public.clubs c where c.id=a.club_id;
 message:='Your pair has another registration, so we’ve closed this duplicate entry. This does not reject your place in the league. '||
   case when kept.status='approved' then 'The other registration has been approved. Use your partner invitation to claim your place if you have not already done so.'
   else 'The other registration is still awaiting club review. You do not need to register again.' end;
 insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url)
 values(a.requested_by,a.club_id,'registration_duplicate','Duplicate registration closed',message,'/clubs/'||slug||'/register?season='||a.season_id);
 perform rallora_private.enqueue_message(a.club_id,a.requested_by,null,'registration','duplicate:'||a.id,
   'Duplicate registration closed',message,'/clubs/'||slug||'/register?season='||a.season_id);
end $$;
revoke all on function public.rallora_close_duplicate_application(uuid,uuid) from public,anon;
grant execute on function public.rallora_close_duplicate_application(uuid,uuid) to authenticated;
commit;
