begin;

-- Invitations are authoritative only while they remain attached to the approved
-- application and its current partner slot. Older teams have no slot email.
create function rallora_private.current_partner_invite(p_invite uuid)
returns setof public.rallora_team_member_invites
language sql stable set search_path='' as $$
 select i.* from public.rallora_team_member_invites i
 join public.rallora_team_applications a on a.id=i.team_application_id
  and (a.club_id,a.season_id,a.division_id,a.created_team_id)=(i.club_id,i.season_id,i.division_id,i.team_id)
 join public.teams t on t.id=i.team_id and t.division_id=i.division_id
 where i.id=p_invite and i.status in ('pending','claimed')
 and a.status='approved' and a.partner_invite_id=i.id
 and nullif(lower(trim(i.invited_email)),'')=lower(trim(a.partner_email))
 and t.player_two_roster_id is not null and nullif(trim(t.player_two_name),'') is not null
 and (lower(trim(i.invited_email))=nullif(lower(trim(t.player_two_email)),'')
  or (nullif(trim(t.player_two_email),'') is null
   and lower(trim(t.player_two_name))=lower(trim(a.partner_name))));
$$;

-- A movement can leave a slot occupied by a player who has yet to verify an
-- account. The club's movement audit must match the current roster ID and email.
create function rallora_private.player_account_targets(p_email text,p_season uuid default null)
returns table(team_id uuid, season_id uuid, slot integer, invite_id uuid)
language sql stable set search_path='' as $$
 select i.team_id,i.season_id,2,i.id from public.rallora_team_member_invites pending
 cross join lateral rallora_private.current_partner_invite(pending.id) i
 where lower(trim(pending.invited_email))=p_email and (p_season is null or pending.season_id=p_season)
 and pending.status='pending'
 union all
 select t.id,d.season_id,v.slot,null::uuid
 from public.teams t join public.divisions d on d.id=t.division_id
 cross join lateral (values
  (1,t.player_one_roster_id,lower(trim(t.player_one_email))),
  (2,t.player_two_roster_id,lower(trim(t.player_two_email)))
 ) v(slot,roster_id,email)
 where v.email=p_email and v.roster_id is not null and (p_season is null or d.season_id=p_season)
 and exists(
  select 1 from public.rallora_player_movements m
  join public.seasons scoped on scoped.id=m.season_id and scoped.club_id=m.club_id
  cross join lateral jsonb_array_elements(m.after_rosters) r
  where m.season_id=d.season_id
  and r->>'id'=t.id::text
  and exists(
   select 1 from jsonb_array_elements(m.before_rosters) prior
   where prior->>'id'=t.id::text
   and (prior->>('player_'||case v.slot when 1 then 'one' else 'two' end||'_roster_id')) is distinct from v.roster_id::text
  )
  and r->>('player_'||case v.slot when 1 then 'one' else 'two' end||'_roster_id')=v.roster_id::text
  and lower(trim(r->>('player_'||case v.slot when 1 then 'one' else 'two' end||'_email')))=p_email
 )
 and not exists(
  select 1 from public.rallora_team_member_invites pending
  cross join lateral rallora_private.current_partner_invite(pending.id) i
  where v.slot=2 and pending.team_id=t.id and lower(trim(pending.invited_email))=p_email and pending.status='pending'
 );
$$;

create function rallora_private.reconcile_player_account(
 p_user uuid,p_team uuid,p_season uuid,p_slot integer,p_invite uuid default null
) returns uuid language plpgsql set search_path='' as $$
declare
 s public.seasons%rowtype;
 t public.teams%rowtype;
 i public.rallora_team_member_invites%rowtype;
 member public.rallora_team_roster_memberships%rowtype;
 player_email text;
 player_name text;
 request_id uuid;
 request_count integer;
begin
 -- Use the season row lock that late entry, player movements and round changes
 -- already take. Recheck all input after waiting for concurrent changes.
 select * into s from public.seasons where id=p_season for no key update;
 if not found or s.status not in ('draft','active')
 or exists(select 1 from public.seasons child where child.previous_season_id=s.id)
 or not exists(select 1 from public.clubs c where c.id=s.club_id and c.is_active) then return null; end if;

 select nullif(lower(trim(u.email)),'') into player_email
 from auth.users u where u.id=p_user and u.email_confirmed_at is not null
 and (u.banned_until is null or u.banned_until<=now())
 and u.deleted_at is null
 for share;
 if player_email is null or (
  select count(*) from auth.users u where lower(trim(u.email))=player_email and u.deleted_at is null
 )<>1 then return null; end if;

 select team.* into t from public.teams team
 join public.divisions d on d.id=team.division_id and d.season_id=s.id
 where team.id=p_team and team.is_active is distinct from false for update of team;
 if not found then return null; end if;

 if p_invite is not null then
  -- Lock this row before re-reading its validated state.
  perform id from public.rallora_team_member_invites where id=p_invite for update;
  select * into i from rallora_private.current_partner_invite(p_invite);
  if not found or i.team_id<>t.id or i.season_id<>s.id or i.club_id<>s.club_id
   or lower(trim(i.invited_email))<>player_email or p_slot<>2
   or (i.status='claimed' and i.claimed_by is distinct from p_user) then return null; end if;
 else
  if not exists(select 1 from rallora_private.player_account_targets(player_email,s.id) x
    where x.team_id=t.id and x.slot=p_slot and x.invite_id is null) then return null; end if;
 end if;

 -- Existing records may use an application contact rather than a populated slot
 -- email. Count either source once for each current pairing slot.
 if exists(
  select 1 from public.teams other join public.divisions d on d.id=other.division_id
  cross join lateral (values(1,other.player_one_email),(2,other.player_two_email)) v(slot,email)
  where d.season_id=s.id and other.is_active is distinct from false
  and (other.id,v.slot)<>(t.id,p_slot)
  and (lower(trim(v.email))=player_email
   or (v.slot=2 and exists(
    select 1 from public.rallora_team_member_invites pending
    cross join lateral rallora_private.current_partner_invite(pending.id) candidate
    where pending.team_id=other.id and lower(trim(pending.invited_email))=player_email
   )))
 ) or exists(
  select 1 from public.rallora_team_roster_memberships r
  where r.season_id=s.id and r.player_user_id=p_user
  and (r.team_id<>t.id or r.club_id<>s.club_id or r.division_id<>t.division_id)
 ) or exists(
  select 1 from public.rallora_team_registration_requests r
  where r.season_id=s.id and r.player_user_id=p_user and r.status in ('pending','approved')
  and (r.team_id is distinct from t.id or r.club_id<>s.club_id or r.division_id is distinct from t.division_id or r.status='pending')
 ) or exists(
  select 1 from public.rallora_team_applications a
  where a.season_id=s.id and a.requested_by=p_user and a.status in ('pending','approved')
  and (a.status='pending' or a.created_team_id is distinct from t.id)
 ) then return null; end if;

 select count(*),(array_agg(r.id))[1] into request_count,request_id
 from public.rallora_team_registration_requests r
 where r.season_id=s.id and r.club_id=s.club_id and r.division_id=t.division_id
 and r.team_id=t.id and r.player_user_id=p_user and r.status='approved';
 if request_count>1
 or exists(
  select 1 from public.rallora_team_roster_memberships r
  where r.team_id=t.id and r.player_user_id<>p_user
  and r.role=case when p_slot=1 then 'captain' else 'player' end
 ) then return null; end if;

 select * into member from public.rallora_team_roster_memberships
 where team_id=t.id and player_user_id=p_user;
 if found and (member.registration_request_id is distinct from request_id
  or member.season_id<>s.id or member.club_id<>s.club_id or member.division_id<>t.division_id
  or (p_slot=2 and member.role='captain')) then return null; end if;
 -- Never take over a claimed invitation that no longer has its original access.
 if i.status='claimed' then
  if member.id is not null then return t.id; end if;
  return null;
 end if;

 player_name:=case p_slot when 1 then t.player_one_name when 2 then t.player_two_name end;
 if coalesce(length(trim(player_name)),0) not between 2 and 120 then return null; end if;
 if request_id is null then
  insert into public.rallora_team_registration_requests(
   club_id,season_id,division_id,team_id,player_user_id,player_name,status,reviewed_at)
  values(s.club_id,s.id,t.division_id,t.id,p_user,player_name,'approved',now())
  returning id into request_id;
 end if;
 if member.id is null then
  insert into public.rallora_team_roster_memberships(
   registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role)
  values(request_id,s.club_id,s.id,t.division_id,t.id,p_user,case when p_slot=1 then 'captain' else 'player' end);
 end if;
 insert into public.rallora_player_profiles(user_id,display_name,playtomic_rating,playtomic_email,updated_at)
 values(p_user,player_name,coalesce(i.playtomic_rating,case p_slot when 1 then t.player_one_rating else t.player_two_rating end),
  coalesce((select a.partner_playtomic_email from public.rallora_team_applications a where a.id=i.team_application_id),player_email),now())
 on conflict(user_id) do update set
  playtomic_rating=coalesce(public.rallora_player_profiles.playtomic_rating,excluded.playtomic_rating),
  playtomic_email=coalesce(nullif(public.rallora_player_profiles.playtomic_email,player_email),excluded.playtomic_email),
  updated_at=now()
 where (public.rallora_player_profiles.playtomic_rating is null and excluded.playtomic_rating is not null)
  or public.rallora_player_profiles.playtomic_email is distinct from
   coalesce(nullif(public.rallora_player_profiles.playtomic_email,player_email),excluded.playtomic_email);

 if i.id is not null then
  update public.rallora_team_member_invites set status='claimed',claimed_by=p_user,claimed_at=now() where id=i.id;
 end if;
 return t.id;
end $$;

create or replace function public.rallora_claim_team_invite(p_invite_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.rallora_team_member_invites%rowtype; linked_team uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to claim this team place'; end if;
 select * into i from public.rallora_team_member_invites where id=p_invite_id;
 linked_team:=rallora_private.reconcile_player_account(auth.uid(),i.team_id,i.season_id,2,i.id);
 if linked_team is null then
  raise exception 'This invitation cannot be linked. Check your verified Rallora email or contact your club organiser.';
 end if;
 return linked_team;
end $$;

create function rallora_private.reconcile_player_account_targets(p_user uuid,p_season uuid default null)
returns integer language plpgsql set search_path='' as $$
declare target record; linked integer:=0; player_email text;
begin
 select lower(trim(email)) into player_email from auth.users
 where id=p_user and email_confirmed_at is not null and deleted_at is null;
 if not found then return 0; end if;
 for target in
  select x.* from rallora_private.player_account_targets(player_email,p_season) x
  join public.seasons s on s.id=x.season_id
  join public.teams t on t.id=x.team_id
  where s.status in ('draft','active') and t.is_active is distinct from false
  and (x.invite_id is not null or not exists(
   select 1 from public.rallora_team_roster_memberships r where r.team_id=t.id and r.player_user_id=p_user
  ))
  order by x.season_id,x.team_id,x.slot
 loop
  if rallora_private.reconcile_player_account(p_user,target.team_id,target.season_id,target.slot,target.invite_id) is not null
  then linked:=linked+1; end if;
 end loop;
 return linked;
end $$;

create function public.rallora_reconcile_my_player_account()
returns integer language sql security definer set search_path='' as $$
 select rallora_private.reconcile_player_account_targets(auth.uid());
$$;

create function public.rallora_admin_reconcile_player_account(p_user_id uuid,p_season_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(
  select 1 from public.seasons s where s.id=p_season_id and public.rallora_can_manage_club(s.club_id)
 ) then raise exception 'Not authorised'; end if;
 return rallora_private.reconcile_player_account_targets(p_user_id,p_season_id);
end $$;

create function rallora_private.reconcile_new_partner_invite()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
 select u.id into recipient from auth.users u where lower(trim(u.email))=lower(trim(new.invited_email))
 and u.email_confirmed_at is not null and u.deleted_at is null;
 if recipient is not null then
  perform rallora_private.reconcile_player_account(recipient,new.team_id,new.season_id,2,new.id);
 end if;
 return null;
end $$;

-- Approval and late entry insert the invite before attaching it to the
-- approved application. Evaluate the complete transaction at commit.
create constraint trigger reconcile_new_partner_invite
 after insert on public.rallora_team_member_invites deferrable initially deferred
 for each row when (new.status='pending') execute function rallora_private.reconcile_new_partner_invite();

-- Existing movement transactions must verify an account before granting access.
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
 select u.id into uid from auth.users u where lower(trim(u.email))=p_player->>'email'
 and u.email_confirmed_at is not null and u.deleted_at is null
 and (u.banned_until is null or u.banned_until<=now())
 and (select count(*) from auth.users candidate
  where lower(trim(candidate.email))=lower(trim(u.email)) and candidate.deleted_at is null)=1;
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
 if uid is not null then
 insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,status,reviewed_by,reviewed_at)
 values(s.club_id,s.id,t.division_id,t.id,uid,p_player->>'name','approved',auth.uid(),now()) returning id into req;
 insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role,approved_by)
 values(req,s.club_id,s.id,t.division_id,t.id,uid,member_role,auth.uid());
 end if;
end $$;

revoke all on function rallora_private.current_partner_invite(uuid),
 rallora_private.player_account_targets(text,uuid),
 rallora_private.reconcile_player_account(uuid,uuid,uuid,integer,uuid),
 rallora_private.reconcile_player_account_targets(uuid,uuid),
 rallora_private.reconcile_new_partner_invite()
 from public,anon,authenticated,service_role;

revoke all on function public.rallora_claim_team_invite(uuid),
 public.rallora_reconcile_my_player_account(),public.rallora_admin_reconcile_player_account(uuid,uuid)
 from public,anon,service_role;
grant execute on function public.rallora_claim_team_invite(uuid),
 public.rallora_reconcile_my_player_account(),public.rallora_admin_reconcile_player_account(uuid,uuid)
 to authenticated;

commit;
