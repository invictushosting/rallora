-- Transactional synthetic end-to-end regression tests for late registration.
begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000a01',true);
do $$
declare
  v_season uuid:=gen_random_uuid();
  v_division uuid:=gen_random_uuid();
  v_source_season uuid:='00000000-0000-0000-0000-0000000001a1';
  v_source_team uuid:='00000000-0000-0000-0000-0000000003a1';
  v_captain uuid:='33333333-3333-3333-3333-333333333333';
  v_existing_captain uuid:='44444444-4444-4444-4444-444444444444';
  v_original_request uuid;
  v_first uuid; v_second uuid;
  v_result jsonb; v_existing jsonb;
  v_before integer; v_after integer;
  v_rejected boolean;
begin
  insert into auth.users(id,email) values
   (v_captain,'late-new-captain@example.invalid'),
   (v_existing_captain,'late-existing-captain@example.invalid');
  update public.teams set player_one_name='Existing captain',player_two_name='Existing partner',
    player_one_email='late-existing-captain@example.invalid',
    player_two_email='late-existing-partner@example.invalid' where id=v_source_team;
  insert into public.rallora_team_registration_requests
    (club_id,season_id,division_id,team_id,player_user_id,player_name,status,reviewed_by,reviewed_at)
  values('00000000-0000-0000-0000-0000000000a1',v_source_season,
    '00000000-0000-0000-0000-0000000002a1',v_source_team,v_existing_captain,
    'Existing captain','approved',auth.uid(),now()) returning id into v_original_request;
  insert into public.rallora_team_roster_memberships
    (registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role,approved_by)
  values(v_original_request,'00000000-0000-0000-0000-0000000000a1',v_source_season,
    '00000000-0000-0000-0000-0000000002a1',v_source_team,v_existing_captain,'captain',auth.uid());
  insert into public.seasons(id,club_id,name,status,starts_on,ends_on)
    values(v_season,'00000000-0000-0000-0000-0000000000a1','Late signup test','draft','2026-12-01','2026-12-30');
  insert into public.divisions(id,season_id,name,sort_order) values(v_division,v_season,'Division late',1);
  insert into public.teams(division_id,name,player_one_name,player_two_name)
    values(v_division,'Preexisting 1','A','B') returning id into v_first;
  insert into public.teams(division_id,name,player_one_name,player_two_name)
    values(v_division,'Preexisting 2','C','D') returning id into v_second;
  insert into public.fixtures(season_id,division_id,home_team_id,away_team_id)
    values(v_season,v_division,v_first,v_second);
  select count(*) into v_before from public.fixtures where season_id=v_season;
  v_result:=public.rallora_admin_add_late_team(v_season,v_division,'new',
    'Captain signed up after deadline',null,'Late new pair','New captain',
    'late-new-captain@example.invalid','New partner','late-new-partner@example.invalid');
  if v_result->>'team_id' is null or (v_result->>'fixtures_need_review')::boolean<>true
  then raise exception 'New pairing registration failed'; end if;
  if not exists(select 1 from public.rallora_team_member_invites i where
      i.id=(v_result->>'partner_invite_id')::uuid and i.invited_email='late-new-partner@example.invalid')
  then raise exception 'New partner invitation missing'; end if;
  if not exists(select 1 from public.rallora_team_roster_memberships
      where team_id=(v_result->>'team_id')::uuid and player_user_id=v_captain and role='captain')
  then raise exception 'New captain membership missing'; end if;

  v_existing:=public.rallora_admin_add_late_team(v_season,v_division,'existing',
    'Adding returning pair',v_source_team);
  if v_existing->>'team_id' is null or v_existing->>'team_id'=v_source_team::text then
    raise exception 'Existing pair was not cloned'; end if;
  if not exists(select 1 from public.teams where id=v_source_team and division_id='00000000-0000-0000-0000-0000000002a1')
  then raise exception 'Source team was modified'; end if;
  select count(*) into v_after from public.fixtures where season_id=v_season;
  if v_before<>v_after then raise exception 'Existing fixtures changed'; end if;
  if (select count(*) from public.rallora_late_team_entries where season_id=v_season)<>2
  then raise exception 'Late entry audit missing'; end if;
  v_rejected:=false;
  begin
    perform public.rallora_admin_add_late_team(v_season,v_division,'new',
      'Duplicate test',null,'Duplicate','New captain',
      'late-new-captain@example.invalid','Partner','someone-else@example.invalid');
  exception when others then v_rejected:=true; end;
  if not v_rejected then raise exception 'Duplicate captain pairing accepted'; end if;
  v_rejected:=false;
  begin
    perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000b01',true);
    perform public.rallora_admin_add_late_team(v_season,v_division,'existing','Cross tenant access',v_source_team);
  exception when others then v_rejected:=true; end;
  if not v_rejected then raise exception 'Other club admin could add team'; end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000a01',true);
  if has_function_privilege('anon','public.rallora_admin_add_late_team(uuid,uuid,text,text,uuid,text,text,text,text,text)','execute') then
    raise exception 'Anonymous can call privileged late-entry RPC';
  end if;
end $$;
rollback;
