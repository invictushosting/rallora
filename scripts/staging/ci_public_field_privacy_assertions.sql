-- Disposable synthetic database only. Never run against production.
begin;
update public.teams set captain_email='private-captain@example.invalid',
 player_one_email='private-one@example.invalid',player_two_email='private-two@example.invalid'
 where id='00000000-0000-0000-0000-0000000003a1';

-- Permissions must deny the columns themselves, regardless of row visibility.
do $$ declare role_name text; column_name text; begin
 foreach role_name in array array['anon','authenticated'] loop
  foreach column_name in array array['captain_email','player_one_email','player_two_email'] loop
   if has_column_privilege(role_name,'public.teams',column_name,'select') then
    raise exception 'Contact column % readable by %',column_name,role_name;
   end if;
  end loop;
  foreach column_name in array array['court','booking_starts_at','booking_ends_at','booking_court'] loop
   if has_column_privilege(role_name,'public.fixtures',column_name,'select') then
    raise exception 'Precise booking column % readable by %',column_name,role_name;
   end if;
  end loop;
 end loop;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ declare denied boolean; begin
 if not exists(select 1 from public.teams where id='00000000-0000-0000-0000-0000000003a1') then
  raise exception 'Public league team disappeared';
 end if;
 perform id,name,player_one_name,player_two_name,player_one_rating,player_two_rating from public.teams;
 perform id,home_team_id,away_team_id,play_by,arrangement_status from public.fixtures;
 denied:=false;begin perform captain_email from public.teams;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anon selected a contact address';end if;
 denied:=false;begin perform booking_starts_at from public.fixtures;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anon selected exact match time';end if;
 denied:=false;begin perform public.rallora_admin_season_teams('00000000-0000-0000-0000-0000000001a1');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anon obtained contact RPC';end if;
end $$;
reset role;

set local role authenticated;
-- Ordinary account, including forged editable JWT metadata, cannot use manager access.
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
select set_config('request.jwt.claims','{"user_metadata":{"role":"admin","is_admin":true}}',true);
do $$ declare denied boolean:=false; begin
 begin perform public.rallora_admin_season_teams('00000000-0000-0000-0000-0000000001a1');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Ordinary account obtained contact RPC';end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000a01',true);
do $$ declare denied boolean:=false; begin
 if not exists(select 1 from public.rallora_admin_season_teams('00000000-0000-0000-0000-0000000001a1')
 where id='00000000-0000-0000-0000-0000000003a1' and player_one_email='private-one@example.invalid') then
  raise exception 'Club owner lost scoped contacts';
 end if;
 if exists(select 1 from public.rallora_admin_season_teams('00000000-0000-0000-0000-0000000001a1')
 where division_id='00000000-0000-0000-0000-0000000002b2') then raise exception 'Contact RPC mixed clubs';end if;
 begin perform public.rallora_admin_season_teams('00000000-0000-0000-0000-0000000001b2');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Club owner obtained another club contacts';end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000a02',true);
do $$ declare denied boolean:=false; begin
 begin perform public.rallora_admin_season_teams('00000000-0000-0000-0000-0000000001a1');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Suspended organiser obtained contacts';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
do $$ begin
 if not exists(select 1 from public.rallora_admin_season_teams('00000000-0000-0000-0000-0000000001a1')) then
  raise exception 'Platform administrator lost contact support access';end if;
end $$;
reset role;
rollback;
