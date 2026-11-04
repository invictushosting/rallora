-- Synthetic leagues only. Rehearse activation and a monthly rollover on the
-- current schema, after player movements, chat and invitation changes.
begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
do $$
declare
 club uuid:=gen_random_uuid(); winter uuid:=gen_random_uuid(); ladies uuid:=gen_random_uuid();
 top_box uuid:=gen_random_uuid(); lower_box uuid:=gen_random_uuid(); ladies_box uuid:=gen_random_uuid();
 captain uuid:=gen_random_uuid(); partner uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
 team uuid; first_team uuid; request uuid; next_id uuid; next_team uuid; next_fixture uuid;
 output jsonb; rejected boolean; i integer; before_history jsonb; after_history jsonb;
begin
 insert into public.clubs(id,slug,name) values(club,'parallel-leagues-test','Synthetic Parallel Leagues');
 insert into auth.users(id,email) values(captain,'parallel-captain@example.invalid'),(partner,'parallel-partner@example.invalid'),(outsider,'parallel-outsider@example.invalid');
 insert into public.seasons(id,club_id,name,status,league_format,teams_per_division,promotion_places,relegation_places,competition_ends_on,round_windows)
 values(winter,club,'Winter test','draft','promotion_relegation_cycles',4,1,1,current_date+59,
 jsonb_build_array(jsonb_build_object('starts_on',current_date,'ends_on',current_date+29),jsonb_build_object('starts_on',current_date+30,'ends_on',current_date+59)));
 insert into public.seasons(id,club_id,name,status) values(ladies,club,'Ladies test','draft');
 insert into public.divisions(id,season_id,name,sort_order) values(top_box,winter,'Top',1),(lower_box,winter,'Lower',2),(ladies_box,ladies,'Ladies',1);
 for i in 1..8 loop
  team:=gen_random_uuid();
  insert into public.teams(id,division_id,name,player_one_name,player_two_name,player_one_rating,player_two_rating)
  values(team,case when i<=4 then top_box else lower_box end,'Pair '||i,'Captain '||i,'Partner '||i,2.1,2.2);
  if i=1 then
   first_team:=team;
   insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,status)
   values(club,winter,top_box,team,captain,'Captain 1','approved') returning id into request;
   insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role)
   values(request,club,winter,top_box,team,captain,'captain');
   insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,status)
   values(club,winter,top_box,team,partner,'Partner 1','approved') returning id into request;
   insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role)
   values(request,club,winter,top_box,team,partner,'player');
  end if;
 end loop;
 insert into public.teams(division_id,name,player_one_name,player_two_name) values(ladies_box,'Ladies pair 1','L1','L2'),(ladies_box,'Ladies pair 2','L3','L4');
 perform public.rallora_generate_round_robin(winter,current_date,current_date+29);
 perform public.rallora_generate_round_robin(ladies,current_date,current_date+29);
 perform public.rallora_set_season_status(winter,'active');
 perform public.rallora_set_season_status(ladies,'active');
 if (select count(*) from public.seasons where club_id=club and status='active')<>2 then
  raise exception 'Activating Ladies completed the independent Winter league'; end if;
 -- A failed later-round activation must leave both active leagues unchanged.
 insert into public.seasons(id,club_id,name,status,previous_season_id,rolling_cycle_number)
 values(gen_random_uuid(),club,'Incomplete next round','draft',ladies,2) returning id into next_id;
 rejected:=false;
 begin perform public.rallora_set_season_status(next_id,'active'); exception when raise_exception then rejected:=true; end;
 if not rejected or (select status from public.seasons where id=ladies)<>'active' then raise exception 'Failed successor activation completed Ladies'; end if;
 delete from public.seasons where id=next_id;
 -- Neither signed-out users nor an unrelated account can activate a league.
 perform public.rallora_set_season_status(ladies,'draft');
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 rejected:=false;begin perform public.rallora_set_season_status(ladies,'active');exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Unrelated player activated Ladies';end if;
 perform set_config('request.jwt.claim.sub','',true);
 rejected:=false;begin perform public.rallora_set_season_status(ladies,'active');exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Signed-out activation allowed';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
 perform public.rallora_set_season_status(ladies,'active');
 -- Rollover cannot discard unplayed or disputed fixtures.
 rejected:=false;begin perform public.rallora_create_next_cycle(winter,current_date+30,current_date+59);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Unplayed Winter fixtures advanced';end if;
 update public.fixtures set status='confirmed' where season_id=winter;
 insert into public.results(fixture_id,home_score,away_score,winner_team_id,status)
 select id,'6 6','4 3',least(home_team_id,away_team_id),'confirmed' from public.fixtures where season_id=winter;
 select jsonb_agg(to_jsonb(f) order by f.id) into before_history from public.fixtures f where season_id=winter;
 rejected:=false;begin perform public.rallora_create_next_cycle(winter,current_date+30,current_date+60);exception when raise_exception then rejected:=true;end;
 if not rejected or exists(select 1 from public.seasons where previous_season_id=winter) then raise exception 'Rollover exceeded finish date or left partial data';end if;
 output:=public.rallora_create_next_cycle(winter,current_date+30,current_date+59);
 next_id:=(output->>'season_id')::uuid;
 if (output->>'promoted')::integer<>1 or (output->>'relegated')::integer<>1 or (output->>'teams_carried')::integer<>8 or (output->>'fixture_count')::integer<>12 then raise exception 'Incorrect monthly movement or fixture totals: %',output;end if;
 if (select status from public.seasons where id=next_id)<>'draft' then raise exception 'Successor published before review';end if;
 if (select round_windows from public.seasons where id=next_id) is distinct from (select round_windows from public.seasons where id=winter) then raise exception 'Saved monthly schedule lost';end if;
 select jsonb_agg(to_jsonb(f) order by f.id) into after_history from public.fixtures f where season_id=winter;
 if before_history is distinct from after_history then raise exception 'Rollover changed historical fixtures';end if;
 if exists(select 1 from public.standings where season_id=next_id and (points<>0 or played<>0)) then raise exception 'New round inherited old points';end if;
 if exists(select 1 from public.fixtures where season_id=next_id and (available_from<>current_date+30 or play_by<>current_date+59)) then raise exception 'Next-round fixture dates incorrect';end if;
 select t.id into next_team from public.teams t join public.divisions d on d.id=t.division_id where d.season_id=next_id and t.previous_team_id=first_team;
 if (select count(*) from public.rallora_team_roster_memberships where team_id=next_team and ((player_user_id=captain and role='captain') or (player_user_id=partner and role='player')))<>2 then raise exception 'Both-player access or captain label lost';end if;
 if (select player_one_roster_id from public.teams where id=next_team) is distinct from (select player_one_roster_id from public.teams where id=first_team) then raise exception 'Stable player identity lost';end if;
 -- A direct write cannot leave two active rounds of one league.
 rejected:=false;begin update public.seasons set status='active' where id=next_id;exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Direct write left two active rounds of Winter';end if;
 perform public.rallora_set_season_status(next_id,'active');
 perform public.rallora_set_season_status(next_id,'active'); -- idempotent
 if (select status from public.seasons where id=winter)<>'completed' or (select status from public.seasons where id=ladies)<>'active' or (select status from public.seasons where id=next_id)<>'active' then raise exception 'Rollover activation affected another league';end if;
 -- Both existing accounts can reach the new chat; an unrelated player cannot.
 select id into next_fixture from public.fixtures where season_id=next_id and next_team in(home_team_id,away_team_id) limit 1;
 perform set_config('request.jwt.claim.sub',partner::text,true);
 set local role authenticated;
 output:=public.rallora_fixture_conversation(next_fixture);
 if (output->>'viewer_team_id')::uuid is distinct from next_team or not (output->>'writable')::boolean or (output->>'can_record_booking')::boolean then raise exception 'Partner permissions changed after rollover';end if;
 reset role;
 perform set_config('request.jwt.claim.sub',captain::text,true);
 set local role authenticated;
 output:=public.rallora_fixture_conversation(next_fixture);
 if not (output->>'can_record_booking')::boolean then raise exception 'Captain booking permissions lost';end if;
 reset role;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 set local role authenticated;
 rejected:=false;begin perform public.rallora_fixture_conversation(next_fixture);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Outsider accessed next-round chat';end if;
 reset role;
end $$;
rollback;
