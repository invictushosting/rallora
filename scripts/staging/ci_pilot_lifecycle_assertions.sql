-- Synthetic end-to-end pilot lifecycle assertions. Disposable CI database only.
begin;

do $$
declare
  v_club uuid;
  v_season uuid;
  v_division uuid;
  v_team_a uuid;
  v_team_b uuid;
  v_fixture uuid;
  v_submission uuid;
begin
  select id into v_club from public.clubs order by created_at limit 1;
  select id into v_season from public.seasons where club_id=v_club order by created_at limit 1;
  select id into v_division from public.divisions where season_id=v_season order by sort_order limit 1;

  if v_club is null or v_season is null or v_division is null then
    raise exception 'CI fixture missing club/season/division';
  end if;

  -- Use synthetic auth identities from ci fixture.
  perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
  perform set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","email":"captain-a@example.test"}',true);

  insert into public.rallora_player_profiles(user_id,display_name)
  values('11111111-1111-1111-1111-111111111111','Captain A')
  on conflict(user_id) do nothing;

  insert into public.rallora_team_applications(
    club_id,season_id,requested_by,team_name,captain_name,captain_phone,captain_playtomic_rating,
    partner_name,partner_email,partner_playtomic_rating,status)
  values(
    v_club,v_season,'11111111-1111-1111-1111-111111111111','Lifecycle Team A','Captain A',null,3.4,
    'Partner B','captain-b@example.test',3.2,'pending');

  -- Platform admin approves and assigns division.
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
  select public.rallora_review_team_application(
    (select id from public.rallora_team_applications where team_name='Lifecycle Team A'),
    'approved',v_division
  ) into v_team_a;

  if not exists(select 1 from public.rallora_team_roster_memberships where team_id=v_team_a and role='captain') then
    raise exception 'Captain membership not created on approval';
  end if;

  -- Partner claims their own place.
  perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
  perform set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","email":"captain-b@example.test"}',true);
  perform public.rallora_claim_team_invite(
    (select partner_invite_id from public.rallora_team_applications where team_name='Lifecycle Team A')
  );

  if not exists(select 1 from public.rallora_team_roster_memberships where team_id=v_team_a and player_user_id='22222222-2222-2222-2222-222222222222') then
    raise exception 'Partner membership claim failed';
  end if;

  -- Team B: same user can be captain of another team, exercising multi-team captain access.
  insert into public.rallora_team_applications(
    club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email,status)
  values(
    v_club,v_season,'22222222-2222-2222-2222-222222222222','Lifecycle Team B','Captain B',
    'Partner A','captain-a@example.test','pending');

  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
  select public.rallora_review_team_application(
    (select id from public.rallora_team_applications where team_name='Lifecycle Team B'),
    'approved',v_division
  ) into v_team_b;

  insert into public.fixtures(season_id,division_id,home_team_id,away_team_id,week_number,play_by,available_from,status)
  values(v_season,v_division,v_team_a,v_team_b,77,current_date+7,current_date,'open')
  returning id into v_fixture;

  -- Captain A submits.
  perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
  select public.rallora_submit_captain_result(v_fixture,'6-4, 6-3','4-6, 3-6',v_team_a,'CI lifecycle')
  into v_submission;

  if (select status from public.fixtures where id=v_fixture) <> 'submitted' then
    raise exception 'Fixture not marked submitted';
  end if;

  -- Captain B confirms; official result + standings should follow.
  perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
  perform public.rallora_review_captain_result(v_submission,'confirm');

  if (select status from public.fixtures where id=v_fixture) <> 'confirmed' then
    raise exception 'Fixture not confirmed';
  end if;
  if not exists(select 1 from public.results where fixture_id=v_fixture and status='confirmed') then
    raise exception 'Official result not created';
  end if;
  if not exists(select 1 from public.standings where season_id=v_season and team_id=v_team_a) then
    raise exception 'Standings not recalculated for Team A';
  end if;
  if not exists(select 1 from public.standings where season_id=v_season and team_id=v_team_b) then
    raise exception 'Standings not recalculated for Team B';
  end if;

  -- Organiser recovery should reopen cleanly and remove official result.
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
  perform public.rallora_admin_reopen_fixture(v_fixture);

  if exists(select 1 from public.results where fixture_id=v_fixture) then
    raise exception 'Reopen did not remove official result';
  end if;
  if (select status from public.fixtures where id=v_fixture) <> 'disputed' then
    raise exception 'Reopen did not mark fixture disputed';
  end if;
end $$;

rollback;
