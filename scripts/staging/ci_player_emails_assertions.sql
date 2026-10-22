-- Contact addresses control invitations; Playtomic aliases are kept only for integration matching.
begin;
do $$
declare
  application uuid;
  team uuid;
  invite uuid;
  club uuid := '00000000-0000-0000-0000-0000000000a1';
begin
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
  insert into public.rallora_team_applications(
    club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email,status)
  values(club,'00000000-0000-0000-0000-0000000001a1',
    '11111111-1111-1111-1111-111111111111','Invite checks','Captain A','Partner B','captain-b@example.test','pending')
  returning id into application;
  update public.rallora_team_applications set partner_playtomic_email='partner@privaterelay.appleid.com' where id=application;
  team := public.rallora_review_team_application(application,'approved','00000000-0000-0000-0000-0000000002a1');
  select partner_invite_id into invite from public.rallora_team_applications where id=application;
  if invite is null then raise exception 'Approval did not create partner invite'; end if;
  perform set_config('rallora.test_invite',invite::text,true);
  perform set_config('rallora.test_team',team::text,true);
  if has_function_privilege('anon','public.rallora_claim_team_invite(uuid)','EXECUTE') then
    raise exception 'Anonymous users can claim partner invites';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","email":"captain-a@example.test"}',true);
do $$
declare blocked boolean := false;
begin
  if exists(select 1 from public.rallora_team_member_invites where id=current_setting('rallora.test_invite')::uuid) then
    raise exception 'A different account can read the partner invite';
  end if;
  begin
    perform public.rallora_claim_team_invite(current_setting('rallora.test_invite')::uuid);
  exception when raise_exception then
    if sqlerrm <> 'Sign in with the email address that was invited' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'A different account claimed the invite'; end if;
end $$;

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","email":"CAPTAIN-B@EXAMPLE.TEST"}',true);
do $$
begin
  if exists(select 1 from public.rallora_player_profiles where user_id<>auth.uid()) then raise exception 'Player can read another account’s Playtomic email'; end if;
  if not exists(select 1 from public.rallora_team_member_invites where id=current_setting('rallora.test_invite')::uuid and status='pending') then
    raise exception 'The invited account cannot read its pending invite';
  end if;
  if exists(select 1 from public.rallora_team_member_invites i join public.clubs c on c.id=i.club_id
    where i.id=current_setting('rallora.test_invite')::uuid and c.slug='club-b') then
    raise exception 'Invite appeared under another club';
  end if;
end $$;
reset role;
update public.rallora_team_member_invites set status='cancelled' where id=current_setting('rallora.test_invite')::uuid;
set local role authenticated;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.rallora_claim_team_invite(current_setting('rallora.test_invite')::uuid);
  exception when raise_exception then
    if sqlerrm <> 'This invite has already been used' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'Cancelled invite was claimed'; end if;
end $$;
reset role;
update public.rallora_team_member_invites set status='pending' where id=current_setting('rallora.test_invite')::uuid;
set local role authenticated;
do $$
declare blocked boolean := false; claimed_team uuid;
begin
  claimed_team := public.rallora_claim_team_invite(current_setting('rallora.test_invite')::uuid);
  if (select playtomic_email from public.rallora_player_profiles where user_id=auth.uid()) is distinct from 'partner@privaterelay.appleid.com' then raise exception 'Partner Playtomic alias was lost during claim'; end if;
  if claimed_team <> current_setting('rallora.test_team')::uuid then raise exception 'Claim returned another team'; end if;
  if not exists(select 1 from public.rallora_team_member_invites where id=current_setting('rallora.test_invite')::uuid
    and status='claimed' and claimed_by=auth.uid() and claimed_at is not null) then
    raise exception 'Claim was not recorded against its recipient';
  end if;
  begin
    perform public.rallora_claim_team_invite(current_setting('rallora.test_invite')::uuid);
  exception when raise_exception then
    if sqlerrm <> 'This invite has already been used' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'Invite was claimed twice'; end if;
  if public.rallora_can_manage_team(claimed_team) or public.is_captain_for_team(claimed_team) then
    raise exception 'Partner claim granted captain or organiser access';
  end if;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.rallora_team_roster_memberships
    where team_id=current_setting('rallora.test_team')::uuid
    and player_user_id='22222222-2222-2222-2222-222222222222' and role='player')<>1 then
    raise exception 'Claim did not create exactly one player membership';
  end if;
  if (select count(*) from public.rallora_team_registration_requests
    where team_id=current_setting('rallora.test_team')::uuid
    and player_user_id='22222222-2222-2222-2222-222222222222' and status='approved')<>1 then
    raise exception 'Claim did not create exactly one approved registration';
  end if;
end $$;
rollback;
