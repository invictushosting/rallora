begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
do $$
declare s uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
 c uuid:='00000000-0000-0000-0000-0000000000a1'; captain uuid:=gen_random_uuid(); captain2 uuid:=gen_random_uuid();
 id_a uuid; id_b uuid; pool uuid; f uuid; v bigint; v2 bigint; output jsonb; auth_count integer; rejected boolean;
begin
 select count(*) into auth_count from auth.users;
 insert into auth.users(id,email) values(captain,'optional-cap-one@example.invalid'),(captain2,'optional-cap-two@example.invalid');
 insert into public.seasons(id,club_id,name,status,teams_per_division) values(s,c,'Account optional test','draft',4);
 insert into public.divisions(id,season_id,name) values(d,s,'Division 1');
 insert into public.teams(id,division_id,name,player_one_name,player_two_name,player_one_email,player_two_email,player_one_rating,player_two_rating)
 values(a,d,'Optional A','Captain One','Unclaimed Alice','optional-cap-one@example.invalid','unclaimed-alice@example.invalid',3,3),
 (b,d,'Optional B','Captain Two','Name Only Bob','optional-cap-two@example.invalid',null,3,3);
 select player_two_roster_id into id_a from public.teams where id=a;
 select player_two_roster_id into id_b from public.teams where id=b;
 if id_a is null or id_b is null or id_a=id_b then raise exception 'Independent player identities missing'; end if;
 insert into public.fixtures(id,season_id,division_id,home_team_id,away_team_id,week_number,play_by,status) values(gen_random_uuid(),s,d,a,b,1,'2026-11-07','open') returning id into f;
 insert into public.results(fixture_id,home_score,away_score,winner_team_id,status) values(f,'6-4','6-2',a,'confirmed');
 output:=public.rallora_manage_players('swap',a,2,0,b,2,0);
 if not exists(select 1 from public.teams where id=a and player_two_name='Name Only Bob' and player_two_roster_id=id_b and player_two_email is null)
 or not exists(select 1 from public.teams where id=b and player_two_name='Unclaimed Alice' and player_two_roster_id=id_a) then raise exception 'Accountless swap failed'; end if;
 if not exists(select 1 from public.rallora_player_movements where id=(output->>'audit_id')::uuid and cardinality(affected_player_ids)=0 and cardinality(affected_roster_ids)=2) then raise exception 'Unlinked players missing from audit'; end if;
 -- Name-only entries can move out and return without a fabricated contact/login.
 perform public.rallora_manage_players('standby',a,2,1);
 select id into pool from public.rallora_player_pools where season_id=s and roster_player_id=id_b and status='available';
 if pool is null or not exists(select 1 from public.rallora_player_pools where id=pool and user_id is null and email is null) then raise exception 'Name-only standby failed'; end if;
 perform public.rallora_manage_players('add',a,2,2,p_pool_id=>pool);
 if not exists(select 1 from public.teams where id=a and player_two_roster_id=id_b) then raise exception 'Name-only standby fill failed'; end if;
 -- Full-team replacement returns the other accountless player to standby.
 perform public.rallora_manage_players('standby',b,2,1);
 select id into pool from public.rallora_player_pools where season_id=s and roster_player_id=id_a;
 perform public.rallora_manage_players('add',a,2,3,p_pool_id=>pool);
 if not exists(select 1 from public.rallora_player_pools where season_id=s and roster_player_id=id_b and status='available') then raise exception 'Unclaimed outgoing player lost'; end if;
 if (select count(*) from public.rallora_player_pools where season_id=s and roster_player_id=id_b)<>1 then raise exception 'Duplicate standby registration'; end if;
 -- Re-marking an already placed identity as available must not duplicate it.
 update public.rallora_player_pools set status='available' where id=pool;
 rejected:=false;begin perform public.rallora_manage_players('add',b,2,2,p_pool_id=>pool);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Duplicate unlinked assignment accepted'; end if;
 update public.rallora_player_pools set status='matched' where id=pool;
 -- Accountless captains can move too, while existing captain accounts retain access.
 select roster_version into v from public.teams where id=a;
 select roster_version into v2 from public.teams where id=b;
 perform public.rallora_manage_players('swap',a,2,v,b,1,v2);
 if not exists(select 1 from public.teams where id=b and player_one_roster_id=id_a and captain_email='unclaimed-alice@example.invalid') then raise exception 'Accountless captain assignment failed'; end if;
 if not exists(select 1 from public.rallora_team_roster_memberships where team_id=a and player_user_id=captain2 and role='player') then raise exception 'Registered destination access lost'; end if;
 if (select count(*) from auth.users)<>auth_count+2 then raise exception 'Movement created a login'; end if;
 if (select home_player_names from public.fixtures where id=f)<>array['Captain One','Unclaimed Alice']
 or (select home_score from public.results where fixture_id=f)<>'6-4' then raise exception 'Historical result changed'; end if;
 -- A stale confirmation still fails after identities move.
 rejected:=false;begin perform public.rallora_manage_players('standby',a,2,0);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Stale unlinked roster accepted'; end if;
 -- Ordinary players cannot manufacture accountless entries via owner RLS.
 perform set_config('request.jwt.claim.sub',captain::text,true);
 set local role authenticated;
 rejected:=false;begin
 insert into public.rallora_player_pools(club_id,season_id,user_id,pool_type,player_name) values(c,s,null,'standby','Unauthorised');
 exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Unlinked pool owner RLS bypass'; end if;
 reset role;
end $$;
rollback;
