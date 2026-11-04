-- Transactional checks against disposable CI schema: no test data persists.
begin;

do $test$
declare
  club_id uuid := '00000000-0000-0000-0000-0000000000a1';
  season_id uuid := gen_random_uuid();
  division_id uuid := gen_random_uuid();
  team_a uuid := gen_random_uuid();
  team_b uuid := gen_random_uuid();
  player_id uuid := gen_random_uuid();
  match_id uuid;
  version_before bigint;
  generated_name text;
begin
  insert into auth.users(id,email)
    values(player_id,'auto-name-test-' || left(player_id::text,8) || '@example.invalid');
  insert into public.seasons(id,club_id,name,status,starts_on,ends_on)
    values(season_id,club_id,'Synthetic team naming','draft','2026-11-01','2026-11-30');
  insert into public.divisions(id,season_id,name,sort_order)
    values(division_id,season_id,'Synthetic names',1);

  -- Existing custom team names must not be changed on creation.
  insert into public.teams(id,division_id,name,player_one_name,player_two_name)
    values(team_a,division_id,'Original display label','Alpha','Beta'),
          (team_b,division_id,'Unrelated display label','Gamma','Delta');
  if (select name from public.teams where id=team_a) <> 'Original display label' then
    raise exception 'Insert should preserve a submitted team label';
  end if;

  insert into public.rallora_team_applications
    (club_id,season_id,division_id,requested_by,team_name,captain_name,partner_name,status,created_team_id)
    values(club_id,season_id,division_id,player_id,'Original display label','Alpha','Beta','pending',team_a);
  update public.rallora_team_applications set status='approved' where created_team_id=team_a;

  insert into public.fixtures(season_id,division_id,home_team_id,away_team_id,
    week_number,play_by,status,home_player_names,away_player_names)
    values(season_id,division_id,team_a,team_b,1,'2026-11-09','confirmed',
      array['Alpha','Beta'],array['Gamma','Delta']) returning id into match_id;
  select roster_version into version_before from public.teams where id=team_a;

  -- An unrelated edit leaves manually-entered names and roster versions intact.
  update public.teams set name='Edited custom label' where id=team_a;
  if (select roster_version from public.teams where id=team_a) <> version_before
    or (select team_name from public.rallora_team_applications
        where created_team_id=team_a) <> 'Edited custom label' then
    raise exception 'Simple team rename should not alter roster version';
  end if;

  -- Simulate the real slot writes used by swap, standby and replacement RPCs.
  update public.teams set player_two_name='Incoming Player' where id=team_a;
  if (select name from public.teams where id=team_a) <> 'Alpha / Incoming Player'
    or (select team_name from public.rallora_team_applications
        where created_team_id=team_a) <> 'Alpha / Incoming Player'
    or (select roster_version from public.teams where id=team_a) <> version_before+1 then
    raise exception 'Swap did not synchronise team, application and roster version';
  end if;
  update public.teams set player_one_name=null where id=team_a;
  if (select name from public.teams where id=team_a) <>
    'Player to be confirmed / Incoming Player' then
    raise exception 'Vacancy did not update the pairing name';
  end if;
  update public.teams set player_one_name='Standby Player' where id=team_a;
  if (select name from public.teams where id=team_a) <>
    'Standby Player / Incoming Player' then
    raise exception 'Standby placement did not update the pairing name';
  end if;

  -- A second team's own stored name changes independently.
  update public.teams set player_one_name='Swapped Player' where id=team_b;
  if (select name from public.teams where id=team_b) <> 'Swapped Player / Delta' then
    raise exception 'Second pairing name did not update';
  end if;
  if (select home_player_names from public.fixtures where id=match_id)
       <> array['Alpha','Beta']
    or (select status from public.fixtures where id=match_id) <> 'confirmed' then
    raise exception 'Historical fixture snapshot changed on a player movement';
  end if;

  -- Unique division/team labels must not block a valid player change
  -- merely because another team still has the same legacy custom name.
  update public.teams set name='Collision / Player' where id=team_b;
  update public.teams set player_one_name='Collision', player_two_name='Player'
    where id=team_a;
  generated_name := (select name from public.teams where id=team_a);
  if generated_name <> 'Collision / Player (' || left(team_a::text,8) || ')'
    or (select team_name from public.rallora_team_applications
        where created_team_id=team_a) <> generated_name then
    raise exception 'Name collision prevented the pairing update';
  end if;
end
$test$;

rollback;
