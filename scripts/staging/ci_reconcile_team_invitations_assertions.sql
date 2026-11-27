-- Synthetic Auth identities only. Historical CI fixtures predate this Auth column.
alter table auth.users add column email_confirmed_at timestamptz;
begin;
do $$
declare
  c uuid := '00000000-0000-0000-0000-0000000000a1';
  other_club uuid := '00000000-0000-0000-0000-0000000000b2';
  manager uuid := '00000000-0000-0000-0000-000000000a01';
  captain uuid := gen_random_uuid();
  partner uuid := gen_random_uuid();
  later_partner uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  s uuid := gen_random_uuid();
  s2 uuid := gen_random_uuid();
  d uuid := gen_random_uuid();
  d2 uuid := gen_random_uuid();
  app uuid;
  invite uuid;
  team uuid;
  later_app uuid;
  later_invite uuid;
  later_team uuid;
  conflict_team uuid;
  moved_user uuid := gen_random_uuid();
  move_target uuid;
  standby_id uuid;
  late_approval jsonb;
  v_request uuid;
  denied boolean;
begin
  if has_function_privilege('anon','public.rallora_reconcile_my_team_invites(uuid)','execute')
    or has_function_privilege('anon','public.rallora_admin_reconcile_team_invite(uuid,uuid)','execute')
    or has_function_privilege('authenticated','rallora_private.reconcile_partner_invite(uuid,uuid)','execute') then
    raise exception 'Reconciliation privileges are too broad';
  end if;
  insert into auth.users(id,email) values (manager,'reconcile-manager@example.test') on conflict (id) do nothing;
  insert into auth.users(id,email,email_confirmed_at) values
    (captain,'reconcile-captain@example.test',now()),
    (partner,'reconcile-partner@example.test',now()),
    (outsider,'reconcile-outsider@example.test',now());
  insert into public.seasons(id,club_id,name,status) values
    (s,c,'Reconcile existing account','draft'),(s2,c,'Reconcile new account','draft');
  insert into public.divisions(id,season_id,name) values (d,s,'Division A'),(d2,s2,'Division B');
  perform set_config('request.jwt.claim.sub',manager::text,true);
  insert into public.rallora_team_applications
    (club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email,partner_playtomic_email)
  values (c,s,captain,'Existing pairing','Test Captain','Test Partner','reconcile-partner@example.test','alias@example.test')
  returning id into app;
  team := public.rallora_review_team_application(app,'approved',d);
  select partner_invite_id into invite from public.rallora_team_applications where id=app;
  if not exists (select from public.rallora_team_member_invites where id=invite and claimed_by=partner and status='claimed')
    or not exists (select from public.rallora_team_roster_memberships where team_id=team and player_user_id=partner and role='player')
    or not exists (select from public.rallora_player_profiles where user_id=partner and playtomic_email='alias@example.test') then
    raise exception 'Approval did not reconcile the existing verified partner';
  end if;

  insert into public.rallora_team_applications
    (club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email)
  values (c,s2,captain,'Later pairing','Test Captain','Later Partner','reconcile-later@example.test')
  returning id into later_app;
  later_team := public.rallora_review_team_application(later_app,'approved',d2);
  select partner_invite_id into later_invite from public.rallora_team_applications where id=later_app;

  insert into auth.users(id,email) values (later_partner,'reconcile-later@example.test');
  perform set_config('request.jwt.claim.sub',later_partner::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('email','reconcile-later@example.test')::text,true);
  if public.rallora_reconcile_my_team_invites(c) <> 0 then raise exception 'Unverified account matched'; end if;
  update auth.users set email_confirmed_at=now() where id=later_partner;

  perform set_config('request.jwt.claim.sub',outsider::text,true);
  denied := false;
  begin
    perform public.rallora_admin_reconcile_team_invite(c,later_invite);
  exception when raise_exception then denied := true;
  end;
  if not denied then raise exception 'Player could use the club admin operation'; end if;

  perform set_config('request.jwt.claim.sub',later_partner::text,true);
  insert into public.teams(division_id,name,is_active) values (d2,'Another pairing',true) returning id into conflict_team;
  insert into public.rallora_team_registration_requests
    (club_id,season_id,division_id,team_id,player_user_id,player_name,status)
  values (c,s2,d2,conflict_team,later_partner,'Later Partner','pending') returning id into v_request;
  if public.rallora_reconcile_my_team_invites(c) <> 0 then raise exception 'Conflicting registration accepted'; end if;
  update public.rallora_team_registration_requests set status='withdrawn' where id=v_request;

  update public.teams set player_two_name='Swapped Player' where id=later_team;
  if public.rallora_reconcile_my_team_invites(c) <> 0 then raise exception 'Stale partner slot accepted'; end if;
  update public.teams set player_two_name='Later Partner' where id=later_team;

  insert into public.rallora_team_registration_requests
    (club_id,season_id,division_id,team_id,player_user_id,player_name,status)
  values (c,s2,d2,later_team,later_partner,'Later Partner','pending') returning id into v_request;
  set local role authenticated;
  if public.rallora_reconcile_my_team_invites(other_club) <> 0 then raise exception 'Other club matched'; end if;
  if public.rallora_reconcile_my_team_invites(c) <> 1 then raise exception 'Sign-in did not reconcile the invite'; end if;
  if public.rallora_reconcile_my_team_invites(c) <> 0 then raise exception 'Repeat sign-in tried to relink an existing member'; end if;
  if public.rallora_claim_team_invite(later_invite) <> later_team then raise exception 'Current claim is not idempotent'; end if;
  reset role;

  if (select count(*) from public.rallora_team_registration_requests where team_id=later_team
    and player_user_id=later_partner and status='approved') <> 1
    or not exists (select from public.rallora_team_roster_memberships where team_id=later_team
      and player_user_id=later_partner and registration_request_id=v_request) then
    raise exception 'Same-team registration was duplicated or ignored';
  end if;

  perform set_config('request.jwt.claim.sub',manager::text,true);
  insert into public.teams(division_id,name,player_one_name,player_two_name,player_two_email,is_active)
  values(d2,'Swap pairing','Second Captain','Moved Partner','reconcile-moved@example.test',true)
  returning id into move_target;
  perform public.rallora_manage_players('swap',later_team,2,
    (select roster_version from public.teams where id=later_team),move_target,2,
    (select roster_version from public.teams where id=move_target));
  if not exists(select from public.rallora_team_roster_memberships where team_id=move_target and player_user_id=later_partner)
    or exists(select from public.rallora_team_roster_memberships where team_id=later_team and player_user_id=later_partner) then
    raise exception 'Verified player did not move with the swap';
  end if;

  insert into auth.users(id,email) values (moved_user,'reconcile-moved@example.test');
  perform set_config('request.jwt.claim.sub',moved_user::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('email','reconcile-moved@example.test')::text,true);
  if public.rallora_reconcile_my_roster_moves(c)<>0 then raise exception 'Unverified player linked to moved slot'; end if;
  update auth.users set email_confirmed_at=now() where id=moved_user;
  if public.rallora_reconcile_my_roster_moves(c)<>1 then raise exception 'Verified player did not link to moved slot'; end if;
  if not exists(select from public.rallora_team_roster_memberships where team_id=later_team and player_user_id=moved_user) then
    raise exception 'Player linked to the wrong slot after swap';
  end if;

  perform set_config('request.jwt.claim.sub',manager::text,true);
  perform public.rallora_manage_players('standby',later_team,2,(select roster_version from public.teams where id=later_team));
  select id into standby_id from public.rallora_player_pools where season_id=s2 and user_id=moved_user and status='available';
  perform public.rallora_manage_players('add',later_team,2,(select roster_version from public.teams where id=later_team),p_pool_id=>standby_id);
  if not exists(select from public.rallora_team_roster_memberships where team_id=later_team and player_user_id=moved_user) then
    raise exception 'Adding a verified standby player did not restore appropriate access';
  end if;

  late_approval:=public.rallora_admin_add_late_team_with_ratings(
    s,d,'new','Test late registration',null,null,'Extra Captain','reconcile-outsider@example.test',
    'Moved Partner','reconcile-moved@example.test');
  if not exists(select from public.rallora_team_member_invites
    where id=(late_approval->>'partner_invite_id')::uuid and claimed_by=moved_user and status='claimed') then
    raise exception 'Late approval did not reconcile a verified player';
  end if;
end;
$$;
rollback;
