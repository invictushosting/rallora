begin;
do $$
declare
 v_season uuid := '00000000-0000-0000-0000-0000000001a1';
 v_fixture uuid := '00000000-0000-0000-0000-0000000004a1';
 v_home uuid := '00000000-0000-0000-0000-0000000003a1';
 v_away uuid := '00000000-0000-0000-0000-0000000003a2';
begin
 if public.score_text_total(null)<>0 or public.score_text_total('')<>0
   or public.score_text_total('6 6')<>12 or public.score_text_total('6, 6')<>12
   or public.score_text_total('10')<>10 then
   raise exception 'Numeric and empty score compatibility failed';
 end if;
 if public.score_text_total('6-4, 6-3')<>12 or public.score_text_total('4-6, 3-6')<>7
   or public.score_text_total('7:6, 6:4')<>13
   or public.score_text_total('7–6, 6–4')<>13
   or public.score_text_total('7—6, 6—4')<>13 then
   raise exception 'Mirrored set scores counted opponent games';
 end if;
 update public.results set home_score='6-4, 6-3',away_score='4-6, 3-6',winner_team_id=v_home,status='confirmed'
 where fixture_id=v_fixture;
 if not exists(select 1 from public.standings where season_id=v_season and team_id=v_home and played=1 and won=1 and score_diff=5)
   or not exists(select 1 from public.standings where season_id=v_season and team_id=v_away and played=1 and lost=1 and score_diff=-5) then
   raise exception 'Mirrored scores did not produce opposite game differences';
 end if;
 update public.results set home_score='6, 6',away_score='4, 3' where fixture_id=v_fixture;
 if (select score_diff from public.standings where season_id=v_season and team_id=v_home)<>5 then
   raise exception 'Canonical score notation disagrees with mirrored notation';
 end if;
 update public.results set home_score='6, 4',away_score='4, 6',winner_team_id=null where fixture_id=v_fixture;
 if (select count(*) from public.standings where season_id=v_season and team_id in(v_home,v_away) and drawn=1 and score_diff=0)<>2 then
   raise exception 'Draw handling changed';
 end if;
 update public.fixtures set status='forfeit' where id=v_fixture;
 update public.results set home_score='6-0, 6-0',away_score='0-6, 0-6',winner_team_id=v_home where fixture_id=v_fixture;
 if exists(select 1 from public.standings where season_id=v_season and team_id in(v_home,v_away) and score_diff<>0) then
   raise exception 'Forfeit scores must not add game difference';
 end if;
 if has_function_privilege('authenticated','public.recalculate_standings_for_season(uuid)','EXECUTE') then
   raise exception 'Internal standings calculation became exposed';
 end if;
end $$;
rollback;
