begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
create function public.ci_fail_movement_audit() returns trigger language plpgsql as $fn$
begin
 if current_setting('rallora.test_fail_audit',true)='yes' then raise exception 'Injected audit failure'; end if;
 return new;
end $fn$;
create trigger ci_fail_movement_audit before insert on public.rallora_player_movements for each row execute function public.ci_fail_movement_audit();
do $$
declare s uuid:=gen_random_uuid(); c uuid:='00000000-0000-0000-0000-0000000000a1'; d uuid:=gen_random_uuid(); d2 uuid:=gen_random_uuid();
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); wrong_div uuid:=gen_random_uuid();
 u1 uuid:=gen_random_uuid(); u2 uuid:=gen_random_uuid(); u3 uuid:=gen_random_uuid(); u4 uuid:=gen_random_uuid(); reserve uuid:=gen_random_uuid(); unrelated uuid:=gen_random_uuid();
 pool uuid; req uuid; f uuid; outcome jsonb; rejected boolean; before_state jsonb; before_audit integer;
begin
 insert into auth.users(id,email) values(u1,'move-one@example.invalid'),(u2,'move-two@example.invalid'),(u3,'move-three@example.invalid'),(u4,'move-four@example.invalid'),(reserve,'move-reserve@example.invalid');
 insert into public.seasons(id,club_id,name,status,teams_per_division,starts_on,ends_on) values(s,c,'Synthetic movements','draft',4,'2026-11-01','2026-11-30');
 insert into public.divisions(id,season_id,name,sort_order) values(d,s,'Division 1',1),(d2,s,'Division 2',2);
 insert into public.teams(id,division_id,name,player_one_name,player_two_name,player_one_email,player_two_email,player_one_rating,player_two_rating,captain_email)
 values(a,d,'Move A','Player One','Player Two','move-one@example.invalid','move-two@example.invalid',3,3,'move-one@example.invalid'),
 (b,d,'Move B','Player Three','Player Four','move-three@example.invalid','move-four@example.invalid',4,4,'move-three@example.invalid'),
 (wrong_div,d2,'Wrong division','Unclaimed','Vacancy','unknown@example.invalid',null,3,null,null);
 insert into public.rallora_team_applications(club_id,season_id,division_id,requested_by,team_name,captain_name,partner_name,partner_email,status,created_team_id)
 values(c,s,d,u1,'Move A','Player One','Player Two','move-two@example.invalid','pending',a),
 (c,s,d,u3,'Move B','Player Three','Player Four','move-four@example.invalid','pending',b);
 update public.rallora_team_applications set status='approved' where created_team_id in(a,b);
 for req in select id from auth.users where id in(u1,u2,u3,u4) loop
 insert into public.rallora_team_registration_requests(club_id,season_id,division_id,team_id,player_user_id,player_name,status,reviewed_by,reviewed_at)
 values(c,s,d,case when req in(u1,u2) then a else b end,req,'Original registration','approved',auth.uid(),now()) returning id into pool;
 insert into public.rallora_team_roster_memberships(registration_request_id,club_id,season_id,division_id,team_id,player_user_id,role,approved_by)
 values(pool,c,s,d,case when req in(u1,u2) then a else b end,req,case when req in(u1,u3) then 'captain' else 'player' end,auth.uid());
 end loop;
 insert into public.fixtures(season_id,division_id,home_team_id,away_team_id,week_number,play_by,status) values(s,d,a,b,1,'2026-11-07','open') returning id into f;
 insert into public.results(fixture_id,home_score,away_score,winner_team_id,status) values(f,'6-4','6-3',a,'confirmed');
 if (select home_player_names from public.fixtures where id=f)<>array['Player One','Player Two'] then raise exception 'Result did not snapshot participants'; end if;
 outcome:=public.rallora_manage_players('swap',a,1,0,b,2,0);
 if (select player_one_name from public.teams where id=a)<>'Player Four' or (select player_two_name from public.teams where id=b)<>'Player One' then raise exception 'Swap failed'; end if;
 if not exists(select 1 from public.rallora_team_roster_memberships where team_id=a and player_user_id=u4 and role='captain') then raise exception 'Captain role did not follow destination slot'; end if;
 if exists(select 1 from public.rallora_team_roster_memberships where team_id=a and player_user_id=u1) then raise exception 'Departed captain still assigned'; end if;
 if (select home_player_names from public.fixtures where id=f)<>array['Player One','Player Two'] or (select home_score from public.results where fixture_id=f)<>'6-4' then raise exception 'Historical match changed'; end if;
 if not exists(select 1 from public.rallora_player_movements where id=(outcome->>'audit_id')::uuid and administrator_id=auth.uid() and jsonb_array_length(before_rosters)=2 and jsonb_array_length(after_rosters)=2) then raise exception 'Audit missing'; end if;
 rejected:=false;begin perform public.rallora_manage_players('swap',a,1,0,b,2,0);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Stale concurrent confirmation accepted'; end if;
 rejected:=false;begin perform public.rallora_manage_players('swap',a,1,1,wrong_div,1,0);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Cross-division swap accepted'; end if;
 -- Moving out leaves a vacancy, withdraws account access, creates one standby row.
 perform public.rallora_manage_players('standby',a,1,1);
 if (select player_one_name from public.teams where id=a) is not null then raise exception 'Vacancy not created'; end if;
 if exists(select 1 from public.rallora_team_roster_memberships where team_id=a and player_user_id=u4) then raise exception 'Standby retained team access'; end if;
 select id into pool from public.rallora_player_pools where season_id=s and user_id=u4 and status='available' and pool_type='standby';
 if pool is null then raise exception 'Standby record missing'; end if;
 perform public.rallora_manage_players('add',a,1,2,p_pool_id=>pool);
 if (select player_one_name from public.teams where id=a)<>'Player Four' or (select status from public.rallora_player_pools where id=pool)<>'matched' then raise exception 'Vacant standby assignment failed'; end if;
 insert into public.rallora_player_pools(club_id,season_id,user_id,pool_type,player_name,email,playtomic_rating) values(c,s,reserve,'standby','Reserve Player','move-reserve@example.invalid',3.5) returning id into pool;
 -- Full pairing: incoming standby and outgoing standby happen together.
 perform public.rallora_manage_players('add',a,2,3,p_pool_id=>pool);
 if (select player_two_name from public.teams where id=a)<>'Reserve Player' then raise exception 'Full pairing standby assignment failed'; end if;
 if not exists(select 1 from public.rallora_player_pools where season_id=s and user_id=u2 and status='available') then raise exception 'Outgoing player lost'; end if;
 rejected:=false;begin perform public.rallora_manage_players('add',b,1,1,p_pool_id=>pool);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Used standby accepted'; end if;
 -- Pool status cannot be used to put an already assigned user into another team.
 update public.rallora_player_pools set status='available' where id=pool;
 rejected:=false;begin perform public.rallora_manage_players('add',b,1,1,p_pool_id=>pool);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Duplicate assignment accepted'; end if;
 update public.rallora_player_pools set status='matched' where id=pool;
 -- Same-club but unrelated league entries are ineligible.
 insert into public.seasons(id,club_id,name,status) values(unrelated,c,'Unrelated','draft');
 insert into public.rallora_player_pools(club_id,season_id,user_id,pool_type,player_name,email) values(c,unrelated,u2,'standby','Player Two','move-two@example.invalid') returning id into pool;
 rejected:=false;begin perform public.rallora_manage_players('add',a,2,4,p_pool_id=>pool);exception when others then rejected:=true;end;
 if not rejected then raise exception 'Wrong competition accepted'; end if;
 -- Capture state for permission denials; injected transactional failure follows below.
 select to_jsonb(x) into before_state from public.teams x where id=a;
 select count(*) into before_audit from public.rallora_player_movements;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000b01',true);
 rejected:=false;begin perform public.rallora_manage_players('standby',a,2,4);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Other club admin was allowed'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 rejected:=false;begin perform public.rallora_manage_players('standby',a,2,4);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Unauthenticated movement allowed'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
 if (select to_jsonb(x) from public.teams x where id=a)<>before_state or (select count(*) from public.rallora_player_movements)<>before_audit then raise exception 'Failed operation changed data'; end if;
 -- Reject an error at the END of the operation and verify all earlier writes roll back.
 perform set_config('rallora.test_fail_audit','yes',true);
 rejected:=false;begin perform public.rallora_manage_players('standby',a,2,4);exception when raise_exception then rejected:=sqlerrm='Injected audit failure';end;
 if not rejected then raise exception 'Audit failure did not abort the transaction'; end if;
 perform set_config('rallora.test_fail_audit','no',true);
 if (select to_jsonb(x) from public.teams x where id=a)<>before_state
 or not exists(select 1 from public.rallora_team_roster_memberships where team_id=a and player_user_id=reserve)
 or exists(select 1 from public.rallora_player_pools where season_id=s and user_id=reserve and status='available')
 or (select count(*) from public.rallora_player_movements)<>before_audit then raise exception 'Partial transaction persisted'; end if;
 -- Audit rows cannot leak between club administrators.
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000b01',true);
 set local role authenticated;
 if exists(select 1 from public.rallora_player_movements where season_id=s) then raise exception 'Cross-club audit visible'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
 if has_function_privilege('anon','public.rallora_manage_players(text,uuid,integer,bigint,uuid,integer,bigint,uuid)','execute')
 or has_function_privilege('authenticated','rallora_private.assign_roster_slot(uuid,integer,jsonb)','execute')
 or has_function_privilege('authenticated','public.rallora_replace_from_pool(uuid,integer,uuid)','execute') then raise exception 'Unsafe function permission'; end if;
end $$;
rollback;
