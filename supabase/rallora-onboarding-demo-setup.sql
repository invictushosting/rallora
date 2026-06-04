-- Rallora Onboarding Demo Setup
-- Adds an RPC used by the onboarding wizard to create demo teams, captains,
-- fixtures, results, standings, sponsors and cup rules for a newly-created club.
-- Safe to run more than once.

create extension if not exists "pgcrypto";

alter table if exists public.teams
  add column if not exists player_one_name text,
  add column if not exists player_two_name text,
  add column if not exists captain_email text,
  add column if not exists is_active boolean not null default true;

alter table if exists public.fixtures
  add column if not exists fixture_group_type text not null default 'weekly',
  add column if not exists fixture_group_name text,
  add column if not exists available_from date,
  add column if not exists fixtures_per_team int;

alter table if exists public.sponsors
  add column if not exists placement text not null default 'homepage',
  add column if not exists logo_url text,
  add column if not exists website_url text,
  add column if not exists club_id uuid references public.clubs(id) on delete cascade,
  add column if not exists sort_order int not null default 1,
  add column if not exists is_active boolean not null default true;

create table if not exists public.standings (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  played int not null default 0,
  won int not null default 0,
  drawn int not null default 0,
  lost int not null default 0,
  score_diff int not null default 0,
  points int not null default 0,
  updated_at timestamptz not null default now(),
  unique(season_id, team_id)
);

alter table public.standings enable row level security;

drop policy if exists "Public can read standings" on public.standings;
create policy "Public can read standings"
on public.standings for select using (true);

drop policy if exists "Admins can manage standings" on public.standings;
create policy "Admins can manage standings"
on public.standings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.cup_qualifier_rules (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  qualifier_count int not null default 0,
  sort_order int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id, division_id)
);

alter table public.cup_qualifier_rules enable row level security;

drop policy if exists "Public can read cup qualifier rules" on public.cup_qualifier_rules;
create policy "Public can read cup qualifier rules"
on public.cup_qualifier_rules for select using (true);

drop policy if exists "Admins can manage cup qualifier rules" on public.cup_qualifier_rules;
create policy "Admins can manage cup qualifier rules"
on public.cup_qualifier_rules for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.rallora_demo_score_total(input_text text)
returns int
language sql
immutable
as $$
  select coalesce(sum((match)[1]::int), 0)::int
  from regexp_matches(coalesce(input_text, ''), '([0-9]+)', 'g') as match;
$$;

create or replace function public.load_onboarding_demo_data(
  p_club_id uuid,
  p_season_id uuid,
  p_teams_per_league int default 8,
  p_fixtures_per_team int default 3
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date;
  v_team_count int := greatest(4, least(12, coalesce(p_teams_per_league, 8)));
  v_fixture_pack int := greatest(1, least(6, coalesce(p_fixtures_per_team, 3)));
  v_win_points int := 3;
  v_draw_points int := 1;
  v_loss_points int := 0;
  v_forfeit_win_points int := 3;
  v_forfeit_loss_points int := 0;
  v_double_forfeit_points int := 0;
  v_teams_created int := 0;
  v_fixtures_created int := 0;
  v_results_created int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only admins can load onboarding demo data';
  end if;

  if p_club_id is null or p_season_id is null then
    raise exception 'club_id and season_id are required';
  end if;

  select coalesce(starts_on, current_date)
  into v_start
  from public.seasons
  where id = p_season_id
    and club_id = p_club_id;

  if v_start is null then
    raise exception 'Season does not belong to this club or was not found';
  end if;

  select
    coalesce(cr.win_points, 3),
    coalesce(cr.draw_points, 1),
    coalesce(cr.loss_points, 0),
    coalesce(cr.forfeit_win_points, 3),
    coalesce(cr.forfeit_loss_points, 0),
    coalesce(cr.double_forfeit_points, 0)
  into
    v_win_points,
    v_draw_points,
    v_loss_points,
    v_forfeit_win_points,
    v_forfeit_loss_points,
    v_double_forfeit_points
  from public.club_rules cr
  where cr.season_id = p_season_id
     or cr.club_id = p_club_id
     or cr.season_id is null
  order by cr.updated_at desc nulls last, cr.created_at desc nulls last
  limit 1;

  -- Clear only the newly-created season's league data before loading demo content.
  delete from public.results r
  using public.fixtures f
  where r.fixture_id = f.id
    and f.season_id = p_season_id;

  delete from public.fixtures
  where season_id = p_season_id;

  delete from public.standings
  where season_id = p_season_id;

  delete from public.team_captains tc
  using public.teams t
  join public.divisions d on d.id = t.division_id
  where tc.team_id = t.id
    and d.season_id = p_season_id;

  delete from public.teams t
  using public.divisions d
  where t.division_id = d.id
    and d.season_id = p_season_id;

  delete from public.sponsors
  where club_id = p_club_id
    and website_url = 'https://rallora.co/demo';

  delete from public.cup_qualifier_rules
  where season_id = p_season_id;

  create temp table demo_seed (
    seed int,
    team_suffix text,
    player_one text,
    player_two text
  ) on commit drop;

  insert into demo_seed values
    (1, 'Aces', 'Alex Carter', 'Jamie Ellis'),
    (2, 'Bandits', 'Morgan Price', 'Sam Taylor'),
    (3, 'Crushers', 'Chris Bailey', 'Ryan Hughes'),
    (4, 'Dynamos', 'Daniel Brooks', 'Leo Morgan'),
    (5, 'Kings', 'Tom Walker', 'Ben Foster'),
    (6, 'Legends', 'Harry Mitchell', 'Noah James'),
    (7, 'Pirates', 'Oliver Reed', 'Josh Evans'),
    (8, 'Rebels', 'Charlie Stone', 'Ethan Cole'),
    (9, 'Rangers', 'Finley Ward', 'Luca Hill'),
    (10, 'Storm', 'Mason Wood', 'Oscar Bell'),
    (11, 'Titans', 'Archie Cox', 'Max Turner'),
    (12, 'Warriors', 'Theo Gray', 'Callum Green');

  insert into public.teams (
    division_id,
    name,
    player_one_name,
    player_two_name,
    captain_email,
    is_active
  )
  select
    d.id,
    left(regexp_replace(coalesce(d.name, 'League'), '[^A-Za-z0-9]+', ' ', 'g'), 18) || ' ' || s.team_suffix,
    s.player_one,
    s.player_two,
    lower('captain-' || row_number() over (order by d.sort_order, d.name) || '-' || s.seed || '@demo.rallora.local'),
    true
  from public.divisions d
  join demo_seed s on s.seed <= v_team_count
  where d.season_id = p_season_id
  order by d.sort_order, s.seed;

  get diagnostics v_teams_created = row_count;

  insert into public.team_captains (team_id, email)
  select t.id, t.captain_email
  from public.teams t
  join public.divisions d on d.id = t.division_id
  where d.season_id = p_season_id
    and t.captain_email is not null
  on conflict do nothing;

  create temp table demo_fixture_plan (
    week_number int,
    home_seed int,
    away_seed int
  ) on commit drop;

  insert into demo_fixture_plan values
    (1, 1, 8), (1, 2, 7), (1, 3, 6), (1, 4, 5),
    (2, 1, 7), (2, 8, 6), (2, 2, 5), (2, 3, 4),
    (3, 1, 6), (3, 7, 5), (3, 8, 4), (3, 2, 3);

  -- Keep fixture plan valid for smaller team counts.
  delete from demo_fixture_plan
  where home_seed > v_team_count
     or away_seed > v_team_count
     or week_number > v_fixture_pack;

  insert into public.fixtures (
    season_id,
    division_id,
    week_number,
    home_team_id,
    away_team_id,
    play_by,
    court,
    status,
    fixture_group_type,
    fixture_group_name,
    available_from,
    fixtures_per_team
  )
  select
    p_season_id,
    d.id,
    p.week_number,
    home_team.id,
    away_team.id,
    (v_start + ((p.week_number * 7) - 1))::date,
    'Arrange',
    case when p.week_number <= 2 then 'confirmed' else 'open' end,
    case when v_fixture_pack >= 3 then 'weekly' else 'pack' end,
    case when v_fixture_pack >= 3 then 'Week ' || p.week_number else 'Demo Fixture Pack' end,
    (v_start + ((p.week_number - 1) * 7))::date,
    v_fixture_pack
  from public.divisions d
  join demo_fixture_plan p on true
  join demo_seed hs on hs.seed = p.home_seed
  join demo_seed asg on asg.seed = p.away_seed
  join public.teams home_team on home_team.division_id = d.id and home_team.name = left(regexp_replace(coalesce(d.name, 'League'), '[^A-Za-z0-9]+', ' ', 'g'), 18) || ' ' || hs.team_suffix
  join public.teams away_team on away_team.division_id = d.id and away_team.name = left(regexp_replace(coalesce(d.name, 'League'), '[^A-Za-z0-9]+', ' ', 'g'), 18) || ' ' || asg.team_suffix
  where d.season_id = p_season_id;

  get diagnostics v_fixtures_created = row_count;

  create temp table demo_result_plan (
    week_number int,
    home_seed int,
    away_seed int,
    home_score text,
    away_score text,
    home_wins boolean
  ) on commit drop;

  insert into demo_result_plan values
    (1, 1, 8, '6,6', '3,4', true),
    (1, 2, 7, '4,6,7', '6,3,5', true),
    (1, 3, 6, '3,4', '6,6', false),
    (1, 4, 5, '6,7', '4,5', true),
    (2, 1, 7, '6,6', '2,4', true),
    (2, 8, 6, '4,4', '6,6', false),
    (2, 2, 5, '6,3,6', '4,6,4', true),
    (2, 3, 4, '2,6,4', '6,4,6', false);

  delete from demo_result_plan
  where home_seed > v_team_count
     or away_seed > v_team_count
     or week_number > least(2, v_fixture_pack);

  insert into public.results (
    fixture_id,
    home_score,
    away_score,
    winner_team_id,
    notes,
    status,
    confirmed_at
  )
  select
    f.id,
    rp.home_score,
    rp.away_score,
    case when rp.home_wins then f.home_team_id else f.away_team_id end,
    'Demo confirmed result',
    'confirmed',
    now()
  from public.fixtures f
  join public.divisions d on d.id = f.division_id
  join demo_result_plan rp on rp.week_number = f.week_number
  join demo_seed hs on hs.seed = rp.home_seed
  join demo_seed asg on asg.seed = rp.away_seed
  join public.teams home_team on home_team.id = f.home_team_id and home_team.name = left(regexp_replace(coalesce(d.name, 'League'), '[^A-Za-z0-9]+', ' ', 'g'), 18) || ' ' || hs.team_suffix
  join public.teams away_team on away_team.id = f.away_team_id and away_team.name = left(regexp_replace(coalesce(d.name, 'League'), '[^A-Za-z0-9]+', ' ', 'g'), 18) || ' ' || asg.team_suffix
  where f.season_id = p_season_id
  on conflict (fixture_id) do update set
    home_score = excluded.home_score,
    away_score = excluded.away_score,
    winner_team_id = excluded.winner_team_id,
    notes = excluded.notes,
    status = excluded.status,
    confirmed_at = excluded.confirmed_at;

  get diagnostics v_results_created = row_count;

  insert into public.standings (
    season_id,
    division_id,
    team_id,
    played,
    won,
    drawn,
    lost,
    score_diff,
    points
  )
  select p_season_id, d.id, t.id, 0, 0, 0, 0, 0, 0
  from public.divisions d
  join public.teams t on t.division_id = d.id
  where d.season_id = p_season_id
  on conflict (season_id, team_id) do update set
    played = 0,
    won = 0,
    drawn = 0,
    lost = 0,
    score_diff = 0,
    points = 0,
    updated_at = now();

  with result_rows as (
    select
      f.season_id,
      f.division_id,
      f.home_team_id,
      f.away_team_id,
      r.winner_team_id,
      public.rallora_demo_score_total(r.home_score) - public.rallora_demo_score_total(r.away_score) as home_diff
    from public.results r
    join public.fixtures f on f.id = r.fixture_id
    where f.season_id = p_season_id
      and r.status in ('confirmed', 'admin_override')
  ),
  team_rows as (
    select
      season_id,
      division_id,
      home_team_id as team_id,
      1 as played,
      case when winner_team_id = home_team_id then 1 else 0 end as won,
      0 as drawn,
      case when winner_team_id = away_team_id then 1 else 0 end as lost,
      home_diff as score_diff,
      case
        when winner_team_id = home_team_id then v_win_points
        when winner_team_id = away_team_id then v_loss_points
        else v_draw_points
      end as points
    from result_rows

    union all

    select
      season_id,
      division_id,
      away_team_id as team_id,
      1 as played,
      case when winner_team_id = away_team_id then 1 else 0 end as won,
      0 as drawn,
      case when winner_team_id = home_team_id then 1 else 0 end as lost,
      -home_diff as score_diff,
      case
        when winner_team_id = away_team_id then v_win_points
        when winner_team_id = home_team_id then v_loss_points
        else v_draw_points
      end as points
    from result_rows
  ),
  aggregated as (
    select
      season_id,
      division_id,
      team_id,
      sum(played)::int as played,
      sum(won)::int as won,
      sum(drawn)::int as drawn,
      sum(lost)::int as lost,
      sum(score_diff)::int as score_diff,
      sum(points)::int as points
    from team_rows
    group by season_id, division_id, team_id
  )
  update public.standings s
  set played = a.played,
      won = a.won,
      drawn = a.drawn,
      lost = a.lost,
      score_diff = a.score_diff,
      points = a.points,
      division_id = a.division_id,
      updated_at = now()
  from aggregated a
  where s.season_id = a.season_id
    and s.team_id = a.team_id;

  insert into public.sponsors (
    club_id,
    name,
    sponsor_type,
    placement,
    logo_url,
    website_url,
    is_active,
    sort_order
  )
  values
    (p_club_id, 'Demo League Sponsor', 'League Sponsor', 'homepage,all-divisions', null, 'https://rallora.co/demo', true, 1),
    (p_club_id, 'Demo Cup Sponsor', 'Cup Sponsor', 'cup,homepage', null, 'https://rallora.co/demo', true, 2),
    (p_club_id, 'Demo Court Partner', 'Court Partner', 'fixtures,footer', null, 'https://rallora.co/demo', true, 3)
  on conflict do nothing;

  insert into public.cup_qualifier_rules (
    season_id,
    division_id,
    qualifier_count,
    sort_order,
    is_active
  )
  select
    p_season_id,
    division_id,
    case when league_number = 1 then 3 when league_number = 2 then 3 when league_number = 3 then 2 else 0 end,
    sort_order,
    league_number <= 3
  from (
    select
      d.id as division_id,
      d.sort_order,
      row_number() over (order by d.sort_order, d.name) as league_number
    from public.divisions d
    where d.season_id = p_season_id
  ) x
  on conflict (season_id, division_id) do update set
    qualifier_count = excluded.qualifier_count,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = now();

  return jsonb_build_object(
    'teams_created', v_teams_created,
    'fixtures_created', v_fixtures_created,
    'results_created', v_results_created,
    'teams_per_league', v_team_count,
    'fixtures_per_team', v_fixture_pack
  );
end;
$$;

grant execute on function public.rallora_demo_score_total(text) to authenticated;
grant execute on function public.load_onboarding_demo_data(uuid, uuid, int, int) to authenticated;

notify pgrst, 'reload schema';
