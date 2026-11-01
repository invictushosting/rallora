-- Exercise the original failure: standings exist before rating seeding/manual swaps.
-- Synthetic data only; roll everything back, including generated notifications.
begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
do $$
declare
 s uuid:=gen_random_uuid(); other_season uuid:=gen_random_uuid();
 boxes uuid[]:='{}'; ids uuid[]:='{}'; box uuid; team uuid; i integer;
 output jsonb; rejected boolean; fixture_ids uuid[]; moved_standing uuid;
begin
 insert into public.seasons(id,club_id,name,status,teams_per_division,starts_on,ends_on)
 values(s,'00000000-0000-0000-0000-0000000000a1','Standings placement regression','draft',2,'2026-11-02','2026-11-30'),
 (other_season,'00000000-0000-0000-0000-0000000000a1','Independent standings league','draft',2,'2026-11-02','2026-11-30');
 for i in 1..4 loop
  box:=gen_random_uuid(); boxes:=array_append(boxes,box);
  insert into public.divisions(id,season_id,name,sort_order) values(box,s,'Box '||i,i);
 end loop;
 for i in 1..8 loop
  insert into public.teams(division_id,name,player_one_name,player_two_name,player_one_rating,player_two_rating)
  values(boxes[1+(i-1)/2],'Regression pair '||i,'First '||i,'Second '||i,i::numeric/2,i::numeric/2)
  returning id into team;
  ids:=array_append(ids,team);
 end loop;
 perform public.recalculate_standings_for_season(s);
 if (select count(*) from public.standings where season_id=s)<>8 then raise exception 'Initial table missing teams'; end if;
 select id into moved_standing from public.standings where season_id=s and team_id=ids[8];
 perform public.rallora_generate_round_robin(s,'2026-11-02','2026-11-30');
 output:=public.rallora_place_draft_boxes(s,true);
 if (output->>'fixtures_cleared')::int<>4 then raise exception 'Seeding did not clear draft fixtures'; end if;
 if not exists(select 1 from public.teams where id=ids[8] and division_id=boxes[1]) then raise exception 'Rating seed not applied'; end if;
 if exists(select 1 from public.standings st join public.teams t on t.id=st.team_id where st.season_id=s and st.division_id<>t.division_id) then raise exception 'Rating seeding left stale standings'; end if;
 -- Full-box swap must update both table rows before fixtures are regenerated.
 perform public.rallora_place_draft_boxes(s,false,ids[8],boxes[4],ids[1]);
 if not exists(select 1 from public.standings where id=moved_standing and division_id=boxes[4]) then raise exception 'Swap lost standing ID or retained old box'; end if;
 if (select count(*) from public.divisions d where d.season_id=s and (select count(*) from public.standings st where st.division_id=d.id)=2)<>4 then raise exception 'Uneven tables after swap'; end if;
 -- Database cascade protects authorised writes outside the placement RPC too.
 update public.standings set played=3,won=3,points=9 where id=moved_standing;
 update public.teams set division_id=boxes[3] where id=ids[8];
 if not exists(select 1 from public.standings where id=moved_standing and division_id=boxes[3] and played=3 and points=9) then raise exception 'Placement cascade lost score totals'; end if;
 update public.teams set division_id=boxes[4] where id=ids[8];
 perform public.recalculate_standings_for_season(s);
 -- Stale writes and cross-season links must fail rather than corrupt public tables.
 rejected:=false;
 begin update public.standings set division_id=boxes[1] where id=moved_standing;
 exception when foreign_key_violation then rejected:=true; end;
 if not rejected then raise exception 'Stale table division accepted'; end if;
 rejected:=false;
 begin update public.standings set season_id=other_season where id=moved_standing;
 exception when foreign_key_violation then rejected:=true; end;
 if not rejected then raise exception 'Cross-season table link accepted'; end if;
 output:=public.rallora_generate_round_robin(s,'2026-11-02','2026-11-30');
 if (output->>'fixture_count')::int<>4 then raise exception 'Incorrect regenerated fixture count'; end if;
 if exists(select 1 from public.fixtures f join public.teams h on h.id=f.home_team_id join public.teams a on a.id=f.away_team_id where f.season_id=s and (f.division_id<>h.division_id or f.division_id<>a.division_id)) then raise exception 'Fixtures disagree with saved placements'; end if;
 select array_agg(id order by id) into fixture_ids from public.fixtures where season_id=s;
 rejected:=false;
 begin perform public.rallora_generate_round_robin(s,'2026-11-02','2026-11-30');
 exception when raise_exception then rejected:=true; end;
 if not rejected or fixture_ids is distinct from (select array_agg(id order by id) from public.fixtures where season_id=s) then raise exception 'Repeated generation changed fixtures'; end if;
 perform public.rallora_set_season_status(s,'active');
 if exists(select 1 from public.standings st join public.teams t on t.id=st.team_id where st.season_id=s and st.division_id<>t.division_id) then raise exception 'Activation left stale tables'; end if;
 if exists(select 1 from public.standings where season_id=other_season) then raise exception 'Independent league changed'; end if;
end $$;
rollback;
