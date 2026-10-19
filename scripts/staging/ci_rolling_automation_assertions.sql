-- Synthetic data only: this test is always rolled back.
begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
do $$
declare
  club uuid:='00000000-0000-0000-0000-0000000000a1';
  season uuid:=gen_random_uuid(); division uuid:=gen_random_uuid(); source uuid:=gen_random_uuid();
  div_a uuid:=gen_random_uuid();div_b uuid:=gen_random_uuid(); team uuid; request uuid; app uuid; invite uuid;
  output jsonb; next_id uuid; rejected boolean; i integer; old_fixture_count integer;
begin
  insert into public.seasons(id,club_id,name,status,cycle_match_mode) values(season,club,'Odd league','draft','single_round_robin');
  insert into public.divisions(id,season_id,name,sort_order) values(division,season,'Five teams',1);
  for i in 1..5 loop insert into public.teams(division_id,name) values(division,'Odd team '||i); end loop;
  output:=public.rallora_generate_round_robin(season,'2026-11-01','2026-11-28');
  if (output->>'fixture_count')::int<>10 then raise exception 'Five teams must produce ten matches'; end if;
  if (select count(distinct week_number) from public.fixtures where season_id=season)<>5 then raise exception 'Five teams need five rounds'; end if;
  if exists(select team_id from (
    select home_team_id team_id from public.fixtures where season_id=season union all
    select away_team_id from public.fixtures where season_id=season) f group by team_id having count(*)<>4) then raise exception 'Each odd-division team must play four times'; end if;
  if exists(select week_number,team_id from (
    select week_number,home_team_id team_id from public.fixtures where season_id=season union all
    select week_number,away_team_id from public.fixtures where season_id=season) f group by week_number,team_id having count(*)>1) then raise exception 'A team played twice in one round'; end if;
  rejected:=false;begin perform public.rallora_generate_round_robin(season,'2026-11-01','2026-11-28');exception when raise_exception then rejected:=true;end;
  if not rejected or (select count(*) from public.fixtures where season_id=season)<>10 then raise exception 'Repeat generation was not blocked'; end if;
  -- Reverse fixtures provide the second leg without duplicates in the first.
  delete from public.fixtures where season_id=season;
  update public.seasons set cycle_match_mode='double_round_robin' where id=season;
  perform public.rallora_generate_round_robin(season,'2026-11-01','2026-12-31');
  if (select count(*) from public.fixtures where season_id=season)<>20 then raise exception 'Double round robin must produce twenty matches'; end if;
  if (select count(distinct (home_team_id,away_team_id)) from public.fixtures where season_id=season)<>20 then raise exception 'Double leg pairings duplicated'; end if;
  delete from public.fixtures where season_id=season;
  update public.seasons set fixture_schedule_mode='weekly',cycle_match_mode='single_round_robin' where id=season;
  rejected:=false;begin perform public.rallora_generate_round_robin(season,'2026-11-01','2026-11-20');exception when raise_exception then rejected:=true;end;
  if not rejected or exists(select 1 from public.fixtures where season_id=season) then raise exception 'Short weekly window left partial fixtures'; end if;
  perform public.rallora_generate_round_robin(season,'2026-11-01','2026-12-05');
  if exists(select 1 from public.fixtures where season_id=season and (available_from<'2026-11-01' or play_by>'2026-12-05' or play_by-available_from<>6)) then raise exception 'Weekly fixture dates invalid'; end if;
  -- An owner of the other club cannot generate or roll this club's fixtures.
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000b01',true);
  rejected:=false;begin perform public.rallora_generate_round_robin(season,'2026-11-01','2026-12-05');exception when raise_exception then rejected:=true;end;
  if not rejected then raise exception 'Cross-club generation was allowed'; end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);

  insert into public.seasons(id,club_id,name,status,league_format,teams_per_division,promotion_places,relegation_places)
    values(source,club,'Rolling test','active','promotion_relegation_cycles',4,2,2);
  insert into public.divisions(id,season_id,name,sort_order) values(div_a,source,'Top division',1),(div_b,source,'Lower division',2);
  for i in 1..8 loop
    team:=('70000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid;
    insert into public.teams(id,division_id,name,player_one_name,player_two_name)
      values(team,case when i<=4 then div_a else div_b end,'Team '||((i-1)%4+1),'Player '||i,'Partner '||i);
    if i=1 then
      insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,status)
        values(club,source,div_a,team,'11111111-1111-1111-1111-111111111111','Captain A','approved') returning id into request;
      insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role)
        values(request,club,source,div_a,team,'11111111-1111-1111-1111-111111111111','captain');
      insert into public.rallora_team_applications(club_id,season_id,division_id,requested_by,team_name,captain_name,partner_name,partner_email,status,created_team_id)
        values(club,source,div_a,'11111111-1111-1111-1111-111111111111','Team 1','Captain A','Invited Partner','partner@example.test','approved',team) returning id into app;
      insert into public.rallora_team_member_invites(team_application_id,club_id,season_id,division_id,team_id,invited_name,invited_email)
        values(app,club,source,div_a,team,'Invited Partner','partner@example.test') returning id into invite;
      update public.rallora_team_applications set partner_invite_id=invite where id=app;
    end if;
  end loop;
  perform public.rallora_generate_round_robin(source,'2026-10-01','2026-10-28');
  rejected:=false;begin perform public.rallora_create_next_cycle(source,'2026-11-01','2026-11-28');exception when raise_exception then rejected:=true;end;
  if not rejected or exists(select 1 from public.seasons where previous_season_id=source) then raise exception 'Unfinished cycle advanced'; end if;
  update public.seasons set require_cycle_completion=false where id=source;
  update public.fixtures set status='disputed' where id=(select id from public.fixtures where season_id=source limit 1);
  rejected:=false;begin perform public.rallora_create_next_cycle(source,'2026-11-01','2026-11-28');exception when raise_exception then rejected:=true;end;
  if not rejected then raise exception 'Disputed cycle advanced when completion was optional'; end if;
  update public.fixtures set status='open' where season_id=source;
  update public.seasons set require_cycle_completion=true where id=source;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000b01',true);
  rejected:=false;begin perform public.rallora_create_next_cycle(source,'2026-11-01','2026-11-28');exception when raise_exception then rejected:=true;end;
  if not rejected then raise exception 'Cross-club rollover was allowed'; end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
  -- Winner ordering gives deterministic ranks 1..4 in each division.
  update public.fixtures set status='confirmed' where season_id=source;
  insert into public.results(fixture_id,home_score,away_score,winner_team_id,status)
    select id,'6 6','4 3',least(home_team_id,away_team_id),'confirmed' from public.fixtures where season_id=source;
  select count(*) into old_fixture_count from public.fixtures where season_id=source;
  -- A too-short new weekly window must roll back the cloned season as well.
  update public.seasons set fixture_schedule_mode='weekly' where id=source;
  rejected:=false;begin perform public.rallora_create_next_cycle(source,'2026-11-01','2026-11-02');exception when raise_exception then rejected:=true;end;
  if not rejected or exists(select 1 from public.seasons where previous_season_id=source) then raise exception 'Failed rollover left orphaned season'; end if;
  update public.seasons set fixture_schedule_mode='date_window' where id=source;
  output:=public.rallora_create_next_cycle(source,'2026-11-01','2026-11-28'); next_id:=(output->>'season_id')::uuid;
  if (output->>'promoted')::int<>2 or (output->>'relegated')::int<>2 or (output->>'teams_carried')::int<>8 then raise exception 'Wrong movement totals'; end if;
  if (select status from public.seasons where id=next_id)<>'draft' or (select registration_published from public.seasons where id=next_id) then raise exception 'Next cycle must remain private'; end if;
  if (select count(*) from public.fixtures where season_id=source)<>old_fixture_count or (select count(*) from public.results r join public.fixtures f on f.id=r.fixture_id where f.season_id=source)<>old_fixture_count then raise exception 'Historical fixtures/results changed'; end if;
  if (select count(*) from public.fixtures where season_id=next_id)<>12 then raise exception 'Next cycle fixtures missing'; end if;
  if exists(select 1 from public.standings where season_id=next_id and (points<>0 or played<>0)) then raise exception 'New cycle inherited points'; end if;
  if (select count(*) from public.rallora_team_roster_memberships where season_id=next_id and role='captain')<>1 then raise exception 'Captain access was not carried'; end if;
  if (select count(*) from public.rallora_team_member_invites where season_id=next_id and status='pending')<>1 then raise exception 'Pending partner invite was not carried'; end if;
  if not exists(select 1 from public.teams t join public.divisions d on d.id=t.division_id where d.season_id=next_id and d.name='Top division' and t.previous_team_id='70000000-0000-0000-0000-000000000005' and t.cycle_movement='promoted') then raise exception 'Lower division winner was not promoted'; end if;
  if not exists(select 1 from public.teams where id='70000000-0000-0000-0000-000000000005' and division_id=div_b) then raise exception 'Old team division was changed'; end if;
  rejected:=false;begin perform public.rallora_create_next_cycle(source,'2026-11-01','2026-11-28');exception when raise_exception then rejected:=true;end;
  if not rejected or (select count(*) from public.seasons where previous_season_id=source)<>1 then raise exception 'Duplicate successor was created'; end if;
  rejected:=false;begin update public.results set winner_team_id=null where fixture_id=(select id from public.fixtures where season_id=source limit 1);exception when raise_exception then rejected:=true;end;
  if not rejected then raise exception 'Archived result could invalidate movement'; end if;
  if has_function_privilege('anon','public.rallora_generate_round_robin(uuid,date,date)','EXECUTE') or has_function_privilege('anon','public.rallora_create_next_cycle(uuid,date,date)','EXECUTE') then raise exception 'Anonymous automation access'; end if;
end $$;
rollback;
