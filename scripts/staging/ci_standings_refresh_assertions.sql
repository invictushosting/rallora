-- Disposable synthetic CI data only. Every change is rolled back.
begin;
do $$
declare
  v_season uuid := '00000000-0000-0000-0000-0000000001a1';
  v_club uuid := '00000000-0000-0000-0000-0000000000a1';
  v_fixture uuid := '00000000-0000-0000-0000-0000000004a1';
  v_home uuid := '00000000-0000-0000-0000-0000000003a1';
  v_away uuid := '00000000-0000-0000-0000-0000000003a2';
begin
  -- A newer club default must not override the season's explicit scoring.
  update public.club_rules set win_points=5,draw_points=2,loss_points=0
  where season_id=v_season;
  insert into public.club_rules(id,club_id,season_id,win_points,draw_points,updated_at)
  values(gen_random_uuid(),v_club,null,20,10,now()+interval '1 day');

  update public.results set winner_team_id=v_home,home_score='6 6',away_score='4 3',status='confirmed'
  where fixture_id=v_fixture;
  if not exists(select 1 from public.standings where team_id=v_home and season_id=v_season
    and played=1 and won=1 and drawn=0 and lost=0 and points=5 and score_diff=5) then
    raise exception 'Season scoring or winning result is incorrect';
  end if;

  -- The old trigger cast NULL winner comparisons to NULL wins/losses.
  update public.results set winner_team_id=null,home_score='6 4',away_score='4 6'
  where fixture_id=v_fixture;
  if (select count(*) from public.standings where season_id=v_season and team_id in(v_home,v_away)
    and played=1 and won=0 and drawn=1 and lost=0 and points=2 and score_diff=0) <> 2 then
    raise exception 'Draw must give both teams numeric zero wins/losses and draw points';
  end if;

  delete from public.club_rules where season_id=v_season;
  update public.results set winner_team_id=v_home where fixture_id=v_fixture;
  if (select points from public.standings where season_id=v_season and team_id=v_home) <> 20 then
    raise exception 'Club default scoring was not applied';
  end if;

  -- A different club's default must never supply this club's scoring.
  insert into public.club_rules(id,club_id,season_id,win_points,draw_points,updated_at)
  values(gen_random_uuid(),'00000000-0000-0000-0000-0000000000b2',null,99,99,now()+interval '2 days');
  delete from public.club_rules where club_id=v_club;
  update public.results set notes='no rules' where fixture_id=v_fixture;
  if (select points from public.standings where season_id=v_season and team_id=v_home) <> 3 then
    raise exception 'Missing rules must use standard points, never another club rules';
  end if;
  perform public.recalculate_standings_for_season(v_season);
  if (select points from public.standings where season_id=v_season and team_id=v_home) <> 3 then
    raise exception 'Explicit recalculation disagrees with result trigger';
  end if;

  update public.results set status='submitted' where fixture_id=v_fixture;
  if exists(select 1 from public.standings where season_id=v_season and played<>0) then
    raise exception 'Unconfirmed results contributed to standings';
  end if;
  update public.results set status='admin_approved' where fixture_id=v_fixture;
  if (select points from public.standings where season_id=v_season and team_id=v_home) <> 3 then
    raise exception 'Admin-approved result was not counted';
  end if;
  delete from public.results where fixture_id=v_fixture;
  if exists(select 1 from public.standings where season_id=v_season and (played<>0 or points<>0)) then
    raise exception 'Deleting a result left stale standings';
  end if;

  if has_function_privilege('anon','public.recalculate_standings_for_season(uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.recalculate_standings_for_season(uuid)','EXECUTE')
    or has_function_privilege('anon','public.rallora_refresh_confirmed_standings()','EXECUTE')
    or has_function_privilege('authenticated','public.rallora_refresh_confirmed_standings()','EXECUTE') then
    raise exception 'Internal standings functions became publicly executable';
  end if;
end $$;
rollback;
