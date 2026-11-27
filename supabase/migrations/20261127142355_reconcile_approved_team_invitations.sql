begin;

-- Only the application's current invitation for a live roster slot is eligible.
-- Older pairings may store the partner's contact address only on the application.
create function rallora_private.current_partner_invites()
returns setof public.rallora_team_member_invites
language sql stable set search_path = '' as $$
  select i.*
  from public.rallora_team_member_invites i
  join public.rallora_team_applications a
    on a.id = i.team_application_id and a.partner_invite_id = i.id
    and (a.club_id, a.season_id, a.division_id, a.created_team_id)
      = (i.club_id, i.season_id, i.division_id, i.team_id)
  join public.teams t on t.id = i.team_id and t.division_id = i.division_id
  join public.divisions d on d.id = t.division_id and d.season_id = i.season_id
  join public.seasons s on s.id = d.season_id and s.club_id = i.club_id
  join public.clubs c on c.id = s.club_id
  where a.status = 'approved' and t.is_active is true and c.is_active is true
    and s.status in ('draft', 'active')
    and not exists (select 1 from public.seasons next where next.previous_season_id = s.id)
    and i.status in ('pending', 'claimed')
    and nullif(trim(i.invited_email), '') is not null
    and lower(trim(a.partner_email)) = lower(trim(i.invited_email))
    and lower(trim(t.player_two_name)) = lower(trim(i.invited_name))
    and lower(trim(a.partner_name)) = lower(trim(i.invited_name))
    and (nullif(trim(t.player_two_email), '') is null
      or lower(trim(t.player_two_email)) = lower(trim(i.invited_email)));
$$;
revoke all on function rallora_private.current_partner_invites() from public, anon, authenticated;

create function rallora_private.reconcile_partner_invite(p_invite_id uuid, p_expected_user uuid default null)
returns uuid language plpgsql set search_path = '' as $$
declare
  i public.rallora_team_member_invites%rowtype;
  v_season uuid;
  v_user uuid;
  v_email text;
  v_captain uuid;
  v_request uuid;
  v_requests integer;
  v_membership public.rallora_team_roster_memberships%rowtype;
begin
  select season_id into v_season from public.rallora_team_member_invites where id = p_invite_id;
  if v_season is null then return null; end if;

  -- Player movements and registration approval use this same season lock.
  perform pg_advisory_xact_lock(hashtextextended(v_season::text, 0));
  perform 1 from public.seasons where id = v_season for update;
  perform t.id from public.teams t
    join public.rallora_team_member_invites i0 on i0.team_id = t.id
    where i0.id = p_invite_id for update of t;
  perform 1 from public.rallora_team_member_invites where id = p_invite_id for update;

  select * into i from rallora_private.current_partner_invites()
    where id = p_invite_id and season_id = v_season;
  if not found then return null; end if;
  v_email := lower(trim(i.invited_email));

  -- Match exactly one verified Auth identity. Playtomic and profile emails are independent.
  select u.id into v_user from auth.users u
    where lower(trim(u.email)) = v_email and u.email_confirmed_at is not null
      and not exists (select 1 from auth.users other
        where other.id <> u.id and lower(trim(other.email)) = v_email)
    for share of u;
  if v_user is null or (p_expected_user is not null and p_expected_user <> v_user)
    or (i.status = 'claimed' and i.claimed_by is distinct from v_user) then
    return null;
  end if;

  select a.requested_by into v_captain from public.rallora_team_applications a
    where a.id = i.team_application_id;
  if v_captain = v_user
    or exists (select 1 from public.rallora_team_roster_memberships m
      where m.season_id = i.season_id and m.team_id <> i.team_id and m.player_user_id = v_user)
    or exists (select 1 from public.rallora_team_registration_requests r
      where r.season_id = i.season_id and r.team_id <> i.team_id
        and r.player_user_id = v_user and r.status in ('pending', 'approved'))
    or exists (select 1 from rallora_private.current_partner_invites() other
      where other.season_id = i.season_id and other.team_id <> i.team_id
        and lower(trim(other.invited_email)) = v_email)
    or exists (select 1 from public.teams t join public.divisions d on d.id = t.division_id
      where d.season_id = i.season_id and t.is_active is true
        and (lower(trim(t.player_one_email)) = v_email
          or (t.id <> i.team_id and lower(trim(t.player_two_email)) = v_email)))
    or exists (select 1 from public.rallora_team_roster_memberships m
      where m.team_id = i.team_id and m.player_user_id not in (v_captain, v_user)) then
    return null;
  end if;

  -- A same-team pending request can be approved using the already-approved invitation.
  -- Preserve existing approval and roster rows and stop on ambiguous registration history.
  select count(*) into v_requests from public.rallora_team_registration_requests r
    where r.team_id = i.team_id and r.player_user_id = v_user and r.status in ('pending', 'approved');
  if v_requests > 1 then return null; end if;
  select r.id into v_request from public.rallora_team_registration_requests r
    where r.team_id = i.team_id and r.player_user_id = v_user and r.status in ('pending', 'approved')
      and (r.club_id, r.season_id, r.division_id) = (i.club_id, i.season_id, i.division_id)
    for update;
  if v_requests = 1 and v_request is null then return null; end if;

  select * into v_membership from public.rallora_team_roster_memberships m
    where m.team_id = i.team_id and m.player_user_id = v_user;
  if found and (v_request is null
    or (v_membership.registration_request_id, v_membership.club_id, v_membership.season_id, v_membership.division_id)
      is distinct from (v_request, i.club_id, i.season_id, i.division_id)) then
    return null;
  end if;

  if v_request is null then
    insert into public.rallora_team_registration_requests
      (club_id, season_id, division_id, team_id, player_user_id, player_name, status, reviewed_at)
    values (i.club_id, i.season_id, i.division_id, i.team_id, v_user, i.invited_name, 'approved', now())
    returning id into v_request;
  else
    update public.rallora_team_registration_requests
    set status = 'approved', reviewed_at = now(), updated_at = now()
    where id = v_request and status = 'pending';
  end if;

  insert into public.rallora_team_roster_memberships
    (registration_request_id, club_id, season_id, division_id, team_id, player_user_id, role)
  values (v_request, i.club_id, i.season_id, i.division_id, i.team_id, v_user, 'player')
  on conflict (team_id, player_user_id) do nothing;

  if i.status = 'pending' then
    insert into public.rallora_player_profiles
      (user_id, display_name, playtomic_rating, playtomic_email)
    select v_user, i.invited_name, coalesce(i.playtomic_rating, a.partner_playtomic_rating),
      coalesce(a.partner_playtomic_email, a.partner_email)
    from public.rallora_team_applications a where a.id = i.team_application_id
    on conflict (user_id) do update set
      playtomic_email = coalesce(nullif(public.rallora_player_profiles.playtomic_email, v_email), excluded.playtomic_email),
      playtomic_rating = coalesce(excluded.playtomic_rating, public.rallora_player_profiles.playtomic_rating),
      updated_at = now();

    update public.rallora_team_member_invites
    set status = 'claimed', claimed_by = v_user, claimed_at = now()
    where id = i.id;

    insert into public.rallora_notifications(recipient_user_id,club_id,notification_type,title,body,action_url)
    select v_user,c.id,'team_linked','Your team is linked',
      'Open Match centre to see your pairing and league fixtures.','/clubs/'||c.slug||'/captain'
    from public.clubs c where c.id=i.club_id;
  end if;
  return i.team_id;
end;
$$;
revoke all on function rallora_private.reconcile_partner_invite(uuid, uuid) from public, anon, authenticated;

create or replace function public.rallora_claim_team_invite(p_invite_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_team uuid;
begin
  if not exists (
    select 1 from public.rallora_team_member_invites i join auth.users u on u.id = auth.uid()
    where i.id = p_invite_id and u.email_confirmed_at is not null
      and lower(trim(u.email)) = lower(trim(i.invited_email))
      and lower(trim(u.email)) = lower(trim(auth.jwt()->>'email'))
  ) then
    raise exception 'Sign in with the verified email address that was invited';
  end if;
  v_team := rallora_private.reconcile_partner_invite(p_invite_id, auth.uid());
  if v_team is null then
    raise exception 'This team invitation needs review by your club organiser';
  end if;
  return v_team;
end;
$$;
revoke all on function public.rallora_claim_team_invite(uuid) from public, anon;
grant execute on function public.rallora_claim_team_invite(uuid) to authenticated;

create function public.rallora_reconcile_my_team_invites(p_club_id uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_invite uuid; v_email text; v_linked integer := 0;
begin
  select lower(trim(u.email)) into v_email from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null
      and lower(trim(u.email)) = lower(trim(auth.jwt()->>'email'));
  if v_email is null then return 0; end if;

  for v_invite in
    select i.id from rallora_private.current_partner_invites() i
    where lower(trim(i.invited_email)) = v_email
      and (p_club_id is null or i.club_id = p_club_id)
      and (i.status = 'pending' or (i.claimed_by = auth.uid() and not exists (
        select 1 from public.rallora_team_roster_memberships m
        where m.team_id = i.team_id and m.player_user_id = auth.uid())))
    order by i.season_id, i.id
  loop
    if rallora_private.reconcile_partner_invite(v_invite, auth.uid()) is not null then
      v_linked := v_linked + 1;
    end if;
  end loop;
  return v_linked;
end;
$$;
revoke all on function public.rallora_reconcile_my_team_invites(uuid) from public, anon;
grant execute on function public.rallora_reconcile_my_team_invites(uuid) to authenticated;

create function public.rallora_admin_reconcile_team_invite(p_club_id uuid, p_invite_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.rallora_can_manage_club(p_club_id) or not exists (
    select 1 from public.rallora_team_member_invites where id = p_invite_id and club_id = p_club_id
  ) then
    raise exception 'Not authorised to check this team invitation';
  end if;
  return rallora_private.reconcile_partner_invite(p_invite_id) is not null;
end;
$$;
revoke all on function public.rallora_admin_reconcile_team_invite(uuid, uuid) from public, anon;
grant execute on function public.rallora_admin_reconcile_team_invite(uuid, uuid) to authenticated;

create function rallora_private.reconcile_after_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Approval already holds the lock. A concurrent manual reissue can be picked up at sign-in.
  if pg_try_advisory_xact_lock(hashtextextended(new.season_id::text, 0)) then
    perform rallora_private.reconcile_partner_invite(new.partner_invite_id);
  end if;
  return new;
end;
$$;
revoke all on function rallora_private.reconcile_after_approval() from public, anon, authenticated;

create trigger reconcile_approved_partner_invite
after update of status, partner_invite_id on public.rallora_team_applications
for each row when (new.status = 'approved' and new.partner_invite_id is not null
  and (old.status is distinct from new.status or old.partner_invite_id is distinct from new.partner_invite_id))
execute function rallora_private.reconcile_after_approval();

-- Remember organiser-approved slots for moved players whose login is not verified yet.
create table rallora_private.pending_roster_account_links (
  team_id uuid not null references public.teams(id) on delete cascade,
  slot integer not null check (slot in (1,2)),
  roster_id uuid not null,
  contact_email text not null,
  member_role text not null check (member_role in ('captain','player')),
  primary key (team_id, slot)
);
create index pending_roster_contact_email on rallora_private.pending_roster_account_links(contact_email);
alter table rallora_private.pending_roster_account_links enable row level security;
revoke all on rallora_private.pending_roster_account_links from public, anon, authenticated;

create function rallora_private.copy_pending_roster_account_links()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into rallora_private.pending_roster_account_links
    (team_id,slot,roster_id,contact_email,member_role)
  select new.id,a.slot,a.roster_id,a.contact_email,a.member_role
  from rallora_private.pending_roster_account_links a where a.team_id=new.previous_team_id
    and a.roster_id=case a.slot when 1 then new.player_one_roster_id else new.player_two_roster_id end
    and a.contact_email=lower(trim(case a.slot when 1 then new.player_one_email else new.player_two_email end));
  return new;
end;
$$;
revoke all on function rallora_private.copy_pending_roster_account_links() from public, anon, authenticated;

create trigger copy_pending_roster_account_links after insert on public.teams
for each row when (new.previous_team_id is not null)
execute function rallora_private.copy_pending_roster_account_links();

create function public.rallora_reconcile_my_roster_moves(p_club_id uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  candidate record;
  a rallora_private.pending_roster_account_links%rowtype;
  s public.seasons%rowtype;
  t public.teams%rowtype;
  v_name text;
  v_request uuid;
  v_requests integer;
  v_linked integer := 0;
begin
  select lower(trim(u.email)) into v_email from auth.users u
    where u.id=v_user and u.email_confirmed_at is not null
      and lower(trim(u.email))=lower(trim(auth.jwt()->>'email'));
  if v_email is null then return 0; end if;

  for candidate in
    select link.team_id,link.slot,d.season_id
    from rallora_private.pending_roster_account_links link
    join public.teams team on team.id=link.team_id
    join public.divisions d on d.id=team.division_id
    join public.seasons season on season.id=d.season_id
    where link.contact_email=v_email and (p_club_id is null or season.club_id=p_club_id)
      and team.is_active is true and season.status in ('draft','active')
      and not exists(select 1 from public.seasons next where next.previous_season_id=season.id)
    order by d.season_id,link.team_id,link.slot
  loop
    perform pg_advisory_xact_lock(hashtextextended(candidate.season_id::text,0));
    select * into s from public.seasons where id=candidate.season_id for update;
    select * into t from public.teams where id=candidate.team_id for update;
    select * into a from rallora_private.pending_roster_account_links
      where team_id=candidate.team_id and slot=candidate.slot for update;
    if not found or a.contact_email is distinct from v_email or t.is_active is distinct from true
      or s.status not in ('draft','active') or (p_club_id is not null and s.club_id<>p_club_id)
      or not exists(select 1 from public.divisions d join public.clubs c on c.id=s.club_id
        where d.id=t.division_id and d.season_id=s.id and c.is_active is true)
      or exists(select 1 from public.seasons next where next.previous_season_id=s.id)
      or a.roster_id is distinct from (case a.slot when 1 then t.player_one_roster_id else t.player_two_roster_id end)
      or v_email is distinct from lower(trim(case a.slot when 1 then t.player_one_email else t.player_two_email end)) then
      continue;
    end if;
    perform 1 from auth.users u where u.id=v_user and u.email_confirmed_at is not null
      and lower(trim(u.email))=v_email and not exists (
        select 1 from auth.users other where other.id<>v_user and lower(trim(other.email))=v_email)
      for share of u;
    if not found then continue; end if;
    if exists(select 1 from public.teams other join public.divisions d on d.id=other.division_id
        cross join lateral(values(1,other.player_one_email),(2,other.player_two_email)) slot(number,email)
        where d.season_id=s.id and other.is_active is true and lower(trim(slot.email))=v_email
          and (other.id<>t.id or slot.number<>a.slot))
      or exists(select 1 from rallora_private.current_partner_invites() i
        where i.season_id=s.id and i.team_id<>t.id and lower(trim(i.invited_email))=v_email)
      or exists(select 1 from public.rallora_team_roster_memberships m
        where m.season_id=s.id and m.player_user_id=v_user and m.team_id<>t.id)
      or exists(select 1 from public.rallora_team_registration_requests r
        where r.season_id=s.id and r.team_id<>t.id and r.player_user_id=v_user and r.status in ('pending','approved')) then
      continue;
    end if;

    v_name:=case a.slot when 1 then t.player_one_name else t.player_two_name end;
    if nullif(trim(v_name),'') is null then continue; end if;
    select count(*) into v_requests from public.rallora_team_registration_requests r
      where r.team_id=t.id and r.player_user_id=v_user and r.status in ('pending','approved');
    if v_requests>1 then continue; end if;
    select r.id into v_request from public.rallora_team_registration_requests r
      where r.team_id=t.id and r.player_user_id=v_user and r.status in ('pending','approved')
        and (r.club_id,r.season_id,r.division_id)=(s.club_id,s.id,t.division_id) for update;
    if v_requests=1 and v_request is null then continue; end if;
    if exists(select 1 from public.rallora_team_roster_memberships m
      where m.team_id=t.id and m.player_user_id=v_user
        and (m.registration_request_id,m.club_id,m.season_id,m.division_id) is distinct from
          (v_request,s.club_id,s.id,t.division_id)) then continue; end if;
    if (select count(*) from public.rallora_team_roster_memberships m where m.team_id=t.id and m.player_user_id<>v_user)>1 then
      continue;
    end if;

    if v_request is null then
      insert into public.rallora_team_registration_requests
        (club_id,season_id,division_id,team_id,player_user_id,player_name,status,reviewed_at)
      values(s.club_id,s.id,t.division_id,t.id,v_user,v_name,'approved',now()) returning id into v_request;
    else
      update public.rallora_team_registration_requests set status='approved',reviewed_at=now(),updated_at=now()
        where id=v_request and status='pending';
    end if;
    insert into public.rallora_team_roster_memberships
      (registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role)
    values(v_request,s.club_id,s.id,t.division_id,t.id,v_user,a.member_role)
    on conflict(team_id,player_user_id) do update set role=excluded.role;
    delete from rallora_private.pending_roster_account_links where team_id=t.id and slot=a.slot;
    v_linked:=v_linked+1;
  end loop;
  return v_linked;
end;
$$;
revoke all on function public.rallora_reconcile_my_roster_moves(uuid) from public, anon;
grant execute on function public.rallora_reconcile_my_roster_moves(uuid) to authenticated;

create or replace function rallora_private.assign_roster_slot(p_team uuid,p_slot integer,p_player jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare t public.teams%rowtype; s public.seasons%rowtype; previous jsonb; uid uuid; old_uid uuid; req uuid; member_role text;
begin
 select * into t from public.teams where id=p_team;
 select x.* into s from public.seasons x join public.divisions d on d.season_id=x.id where d.id=t.division_id;
 previous:=rallora_private.roster_slot(p_team,p_slot);
 select id into old_uid from auth.users where lower(email)=previous->>'email';
 select role into member_role from public.rallora_team_roster_memberships where team_id=t.id and player_user_id=old_uid;
 member_role:=coalesce(member_role,case when lower(t.captain_email)=previous->>'email' or p_slot=1 then 'captain' else 'player' end);
 select u.id into uid from auth.users u
 where lower(trim(u.email))=lower(trim(p_player->>'email')) and u.email_confirmed_at is not null
 and not exists(select 1 from auth.users other where other.id<>u.id and lower(trim(other.email))=lower(trim(u.email)))
 for share of u;
 delete from public.rallora_team_roster_memberships where team_id=t.id and player_user_id=old_uid;
 -- Keep the original registration and invite history; withdraw current access.
 update public.rallora_team_registration_requests set status='withdrawn',organiser_note='Moved by club administrator',updated_at=now()
 where team_id=t.id and player_user_id=old_uid and status in ('approved','pending');
 update public.rallora_team_member_invites set status='cancelled' where team_id=t.id and lower(invited_email)=previous->>'email' and status='pending';
 if p_slot=1 then
 update public.teams set player_one_roster_id=(p_player->>'roster_id')::uuid,player_one_name=p_player->>'name',player_one_email=p_player->>'email',player_one_rating=(p_player->>'rating')::numeric,
 player_one_rating_source=coalesce(p_player->>'rating_source','manual'),captain_email=case when member_role='captain' then p_player->>'email' else captain_email end where id=t.id;
 else
 update public.teams set player_two_roster_id=(p_player->>'roster_id')::uuid,player_two_name=p_player->>'name',player_two_email=p_player->>'email',player_two_rating=(p_player->>'rating')::numeric,
 player_two_rating_source=coalesce(p_player->>'rating_source','manual'),captain_email=case when member_role='captain' then p_player->>'email' else captain_email end where id=t.id;
 end if;
 -- Applications are the current pairing summary used by admin and invitation UI.
 -- The immutable before/after audit below preserves the previous summary.
 update public.rallora_team_applications set
 requested_by=case when p_slot=1 and uid is not null then uid else requested_by end,
 captain_name=case when p_slot=1 then coalesce(p_player->>'name','Player to be confirmed') else captain_name end,
 captain_phone=case when p_slot=1 then null else captain_phone end,
 captain_playtomic_rating=case when p_slot=1 then (p_player->>'rating')::numeric else captain_playtomic_rating end,
 partner_invite_id=case when p_slot=2 then null else partner_invite_id end,
 partner_name=case when p_slot=2 then coalesce(p_player->>'name','Player to be confirmed') else partner_name end,
 partner_email=case when p_slot=2 then p_player->>'email' else partner_email end,
 partner_playtomic_email=case when p_slot=2 then (select coalesce(playtomic_email,p_player->>'email') from public.rallora_player_profiles where user_id=uid) else partner_playtomic_email end,
 partner_playtomic_rating=case when p_slot=2 then (p_player->>'rating')::numeric else partner_playtomic_rating end,
 updated_at=now() where created_team_id=t.id and status='approved';
 delete from rallora_private.pending_roster_account_links where team_id=t.id and slot=p_slot;
 if uid is null and nullif(trim(p_player->>'email'),'') is not null and p_player->>'roster_id' is not null then
   insert into rallora_private.pending_roster_account_links(team_id,slot,roster_id,contact_email,member_role)
   values(t.id,p_slot,(p_player->>'roster_id')::uuid,lower(trim(p_player->>'email')),member_role);
 end if;
 if uid is not null then
 insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,status,reviewed_by,reviewed_at)
 values(s.club_id,s.id,t.division_id,t.id,uid,p_player->>'name','approved',auth.uid(),now()) returning id into req;
 insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role,approved_by)
 values(req,s.club_id,s.id,t.division_id,t.id,uid,member_role,auth.uid());
 end if;
end $$;

commit;
