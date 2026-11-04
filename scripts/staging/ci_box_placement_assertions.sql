begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
do $$
declare s uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); ids uuid[]:='{}'; t uuid; p uuid; captain uuid:=gen_random_uuid(); replacement uuid:=gen_random_uuid(); req uuid; output jsonb; rejected boolean; i integer; fixtures_before integer; played_fixture uuid;
begin
 insert into auth.users(id,email) values(captain,'box-captain@example.invalid'),(replacement,'box-replacement@example.invalid');
 insert into public.seasons(id,club_id,name,status,teams_per_division,starts_on,ends_on) values(s,'00000000-0000-0000-0000-0000000000a1','Box placement test','draft',2,'2026-11-01','2026-11-30');
 insert into public.divisions(id,season_id,name,sort_order) values(a,s,'1A',1),(b,s,'1B',2);
 for i in 1..4 loop
  insert into public.teams(division_id,name,player_one_name,player_two_name,player_one_rating,player_two_rating) values(case when i<=2 then a else b end,'Box pairing '||i,'One '||i,'Two '||i,i,i) returning id into t;ids:=array_append(ids,t);
 end loop;
 output:=public.rallora_place_draft_boxes(s,true);
 if not exists(select 1 from public.teams where id=ids[4] and division_id=a) or not exists(select 1 from public.teams where id=ids[1] and division_id=b) then raise exception 'Ratings did not seed highest pairings first'; end if;
 -- A synced rating overrides an entered value for the same player.
 insert into public.rallora_team_applications(club_id,season_id,requested_by,team_name,captain_name,partner_name,partner_email,status,created_team_id)
 values('00000000-0000-0000-0000-0000000000a1',s,captain,'Rating source','One','Two','other@example.invalid','approved',ids[1]);
 insert into public.rallora_playtomic_player_links(club_id,user_id,padel_rating) values('00000000-0000-0000-0000-0000000000a1',captain,10);
 perform public.rallora_place_draft_boxes(s,true);
 if not exists(select 1 from public.teams where id=ids[1] and division_id=a) then raise exception 'Synced rating was ignored'; end if;
 delete from public.rallora_playtomic_player_links where user_id=captain;
 delete from public.rallora_team_applications where created_team_id=ids[1];
 perform public.rallora_place_draft_boxes(s,true);
 -- Missing values must not silently become zero ratings.
 update public.teams set player_two_rating=null where id=ids[1];
 rejected:=false;begin perform public.rallora_place_draft_boxes(s,true);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Missing rating accepted'; end if;
 update public.teams set player_two_rating=1 where id=ids[1];
 -- Swap full boxes, preserve roster/invite links and clear only unused draft fixtures.
 update public.teams set player_one_email='box-captain@example.invalid' where id=ids[4];
 insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,status,reviewed_by,reviewed_at)
 values('00000000-0000-0000-0000-0000000000a1',s,a,ids[4],captain,'Old captain','approved',auth.uid(),now()) returning id into req;
 insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role,approved_by) values(req,'00000000-0000-0000-0000-0000000000a1',s,a,ids[4],captain,'captain',auth.uid());
 perform public.rallora_generate_round_robin(s,'2026-11-01','2026-11-30');
 -- Activity protection must work against production-shaped tables without fixture scores.
 select id into played_fixture from public.fixtures where season_id=s limit 1;
 update public.fixtures set status='submitted' where id=played_fixture;
 rejected:=false;begin perform public.rallora_place_draft_boxes(s,false,ids[4],b,ids[1]);exception when raise_exception then
  if sqlerrm<>'This draft has match activity; its divisions cannot be changed' then raise; end if;
  rejected:=true;end;
 if not rejected then raise exception 'Submitted fixture allowed box movement'; end if;
 update public.fixtures set status='open' where id=played_fixture;
 insert into public.results(fixture_id,home_score,away_score,winner_team_id,status)
 select id,'6-4','4-6',home_team_id,'confirmed' from public.fixtures where id=played_fixture;
 rejected:=false;begin perform public.rallora_place_draft_boxes(s,true);exception when raise_exception then
  if sqlerrm<>'This draft has match activity; its divisions cannot be changed' then raise; end if;
  rejected:=true;end;
 if not rejected then raise exception 'Recorded result allowed rating seeding'; end if;
 delete from public.results where fixture_id=played_fixture;
 output:=public.rallora_place_draft_boxes(s,false,ids[4],b,ids[1]);
 if (output->>'fixtures_cleared')::int<>2 then raise exception 'Draft fixtures not invalidated'; end if;
 if not exists(select 1 from public.rallora_team_roster_memberships where team_id=ids[4] and division_id=b and player_user_id=captain) then raise exception 'Roster lost or division out of sync'; end if;
 if not exists(select 1 from public.rallora_team_registration_requests where id=req and division_id=b) then raise exception 'Request out of sync'; end if;
 perform public.rallora_generate_round_robin(s,'2026-11-01','2026-11-30');
 perform public.rallora_set_season_status(s,'active');
 rejected:=false;begin perform public.rallora_place_draft_boxes(s,false,ids[4],a,ids[1]);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Active boxes changed'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000b01',true);
 rejected:=false;begin perform public.rallora_place_draft_boxes(s,true);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Other club changed boxes'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
 insert into public.rallora_player_pools(club_id,season_id,user_id,pool_type,player_name,email,playtomic_rating) values('00000000-0000-0000-0000-0000000000a1',s,replacement,'standby','New captain','box-replacement@example.invalid',3) returning id into p;
 select id into played_fixture from public.fixtures where season_id=s limit 1;
 insert into public.results(fixture_id,home_score,away_score,winner_team_id,status) select id,'6-4','4-6',home_team_id,'confirmed' from public.fixtures where id=played_fixture;
 select count(*) into fixtures_before from public.fixtures where season_id=s;
 perform public.rallora_replace_from_pool(ids[4],1,p);
 if public.is_captain_for_team(ids[4]) then raise exception 'Organiser unexpectedly became captain'; end if;
 if exists(select 1 from public.rallora_team_roster_memberships where team_id=ids[4] and player_user_id=captain) then raise exception 'Departed captain retained access'; end if;
 if not exists(select 1 from public.rallora_team_roster_memberships where team_id=ids[4] and player_user_id=replacement and role='captain') then raise exception 'Replacement missing captain access'; end if;
 if (select count(*) from public.fixtures where season_id=s)<>fixtures_before then raise exception 'Replacement changed fixtures'; end if;
 if not exists(select 1 from public.results where results.fixture_id=played_fixture and home_score='6-4' and away_score='4-6') then raise exception 'Replacement changed a recorded result'; end if;
 if not exists(select 1 from public.rallora_player_pools where id=p and status='matched') then raise exception 'Standby not marked placed'; end if;
 rejected:=false;begin perform public.rallora_replace_from_pool(ids[4],1,p);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Standby could be reused'; end if;
 if has_function_privilege('anon','public.rallora_place_draft_boxes(uuid,boolean,uuid,uuid,uuid)','execute') or has_function_privilege('anon','public.rallora_replace_from_pool(uuid,integer,uuid)','execute') then raise exception 'Anonymous write access'; end if;
end $$;
rollback;
