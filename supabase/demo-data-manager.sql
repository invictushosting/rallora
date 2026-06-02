-- GSM Padel League Hub: Demo Data Manager
-- Adds admin RPC buttons support for loading/resetting a complete sales demo.
-- Safe to run more than once.

create extension if not exists "pgcrypto";

-- Keep latest expected columns available.
alter table public.teams
  add column if not exists player_one_name text,
  add column if not exists player_two_name text,
  add column if not exists captain_email text,
  add column if not exists is_active boolean not null default true;

alter table public.fixtures
  add column if not exists fixture_group_type text not null default 'weekly',
  add column if not exists fixture_group_name text,
  add column if not exists available_from date,
  add column if not exists fixtures_per_team int;

alter table public.sponsors
  add column if not exists placement text not null default 'homepage',
  add column if not exists logo_url text,
  add column if not exists website_url text,
  add column if not exists club_id uuid references public.clubs(id) on delete cascade;

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
on public.standings
for select
using (true);

drop policy if exists "Admins can manage standings" on public.standings;
create policy "Admins can manage standings"
on public.standings
for all
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
on public.cup_qualifier_rules
for select
using (true);

drop policy if exists "Admins can manage cup qualifier rules" on public.cup_qualifier_rules;
create policy "Admins can manage cup qualifier rules"
on public.cup_qualifier_rules
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.cup_manual_qualifiers (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  seed_position int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id, team_id),
  unique(season_id, seed_position)
);

alter table public.cup_manual_qualifiers enable row level security;

drop policy if exists "Public can read cup manual qualifiers" on public.cup_manual_qualifiers;
create policy "Public can read cup manual qualifiers"
on public.cup_manual_qualifiers
for select
using (true);

drop policy if exists "Admins can manage cup manual qualifiers" on public.cup_manual_qualifiers;
create policy "Admins can manage cup manual qualifiers"
on public.cup_manual_qualifiers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.demo_slug(input_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(regexp_replace(lower(coalesce(input_text, '')), '&', 'and', 'g'), '[^a-z0-9]+', '-', 'g');
$$;

create or replace function public.demo_score_total(input_text text)
returns int
language sql
immutable
as $$
  select coalesce(sum((match)[1]::int), 0)::int
  from regexp_matches(coalesce(input_text, ''), '([0-9]+)', 'g') as match;
$$;

create or replace function public.reset_demo_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season_id uuid;
  v_club_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can reset demo data';
  end if;

  select id, club_id
  into v_season_id, v_club_id
  from public.seasons
  where status = 'active'
  order by created_at desc
  limit 1;

  if v_season_id is null then
    return;
  end if;

  if to_regclass('public.result_submissions') is not null then
    execute 'delete from public.result_submissions rs using public.fixtures f where rs.fixture_id = f.id and f.season_id = $1'
    using v_season_id;
  end if;

  delete from public.results r
  using public.fixtures f
  where r.fixture_id = f.id
    and f.season_id = v_season_id;

  delete from public.fixtures
  where season_id = v_season_id;

  delete from public.standings
  where season_id = v_season_id;

  delete from public.cup_manual_qualifiers
  where season_id = v_season_id;

  delete from public.cup_qualifier_rules
  where season_id = v_season_id;

  if to_regclass('public.captain_users') is not null then
    execute 'delete from public.captain_users cu using public.teams t, public.divisions d where cu.team_id = t.id and t.division_id = d.id and d.season_id = $1'
    using v_season_id;
  end if;

  if to_regclass('public.team_captains') is not null then
    execute 'delete from public.team_captains tc using public.teams t, public.divisions d where tc.team_id = t.id and t.division_id = d.id and d.season_id = $1'
    using v_season_id;
  end if;

  delete from public.teams t
  using public.divisions d
  where t.division_id = d.id
    and d.season_id = v_season_id;

  delete from public.sponsors
  where coalesce(club_id, v_club_id) = v_club_id
    and lower(coalesce(sponsor_type, '')) like 'demo%';
end;
$$;

create or replace function public.load_demo_club_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
  v_season_id uuid;
  v_start date;
  v_division_count int;
begin
  if not public.is_admin() then
    raise exception 'Only admins can load demo data';
  end if;

  select id
  into v_club_id
  from public.clubs
  where slug = 'gsm-padel'
  order by created_at asc
  limit 1;

  if v_club_id is null then
    insert into public.clubs (slug, name, short_name, logo_url, primary_color, secondary_color, accent_color, is_active)
    values ('gsm-padel', 'GSM Padel', 'GSM', '/gsm-logo.png', '#2458ff', '#0f172a', '#2458ff', true)
    returning id into v_club_id;
  end if;

  select id, coalesce(starts_on, current_date), club_id
  into v_season_id, v_start, v_club_id
  from public.seasons
  where status = 'active'
  order by created_at desc
  limit 1;

  if v_season_id is null then
    insert into public.seasons (name, status, starts_on, ends_on, club_id)
    values ('Demo Showcase 2026', 'active', current_date, current_date + interval '90 days', v_club_id)
    returning id, starts_on into v_season_id, v_start;
  else
    update public.seasons
    set club_id = coalesce(club_id, v_club_id)
    where id = v_season_id;
  end if;

  perform public.reset_demo_data();

  select count(*)
  into v_division_count
  from public.divisions
  where season_id = v_season_id;

  if v_division_count = 0 then
    insert into public.divisions (season_id, name, sort_order)
    values
      (v_season_id, 'Premier League', 1),
      (v_season_id, 'Division 2', 2),
      (v_season_id, 'Division 3', 3)
    on conflict (season_id, name) do nothing;
  end if;

  create temp table demo_team_seed (
    seed int,
    team_name text,
    player_one text,
    player_two text
  ) on commit drop;

  insert into demo_team_seed values
    (1, 'Baseline Bandits', 'Alex Carter', 'Jamie Ellis'),
    (2, 'Net Ninjas', 'Morgan Price', 'Sam Taylor'),
    (3, 'Glass Masters', 'Chris Bailey', 'Ryan Hughes'),
    (4, 'Smash Society', 'Daniel Brooks', 'Leo Morgan'),
    (5, 'Court Kings', 'Tom Walker', 'Ben Foster'),
    (6, 'Lob Stars', 'Harry Mitchell', 'Noah James'),
    (7, 'Padel Pirates', 'Oliver Reed', 'Josh Evans'),
    (8, 'Rally Rebels', 'Charlie Stone', 'Ethan Cole');

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
    s.team_name,
    s.player_one,
    s.player_two,
    lower('demo-' || public.demo_slug(d.name) || '-' || s.seed || '@demo.gsmpadel.local'),
    true
  from public.divisions d
  cross join demo_team_seed s
  where d.season_id = v_season_id
  on conflict (division_id, name) do update set
    player_one_name = excluded.player_one_name,
    player_two_name = excluded.player_two_name,
    captain_email = excluded.captain_email,
    is_active = true;

  if to_regclass('public.captain_users') is not null then
    execute '
      insert into public.captain_users (team_id, email, display_name)
      select t.id, t.captain_email, coalesce(t.player_one_name, t.name || '' captain'')
      from public.teams t
      join public.divisions d on d.id = t.division_id
      where d.season_id = $1 and t.captain_email is not null
      on conflict (email) do update set team_id = excluded.team_id, display_name = excluded.display_name
    ' using v_season_id;
  end if;

  if to_regclass('public.team_captains') is not null then
    execute '
      insert into public.team_captains (team_id, email)
      select t.id, t.captain_email
      from public.teams t
      join public.divisions d on d.id = t.division_id
      where d.season_id = $1 and t.captain_email is not null
      on conflict do nothing
    ' using v_season_id;
  end if;

  create temp table demo_fixture_plan (
    week_number int,
    home_seed int,
    away_seed int
  ) on commit drop;

  insert into demo_fixture_plan values
    (1, 1, 8), (1, 2, 7), (1, 3, 6), (1, 4, 5),
    (2, 1, 7), (2, 8, 6), (2, 2, 5), (2, 3, 4),
    (3, 1, 6), (3, 7, 5), (3, 8, 4), (3, 2, 3);

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
    v_season_id,
    d.id,
    p.week_number,
    home_team.id,
    away_team.id,
    (v_start + ((p.week_number * 7) - 1))::date,
    'Arrange',
    case when p.week_number <= 2 then 'confirmed' else 'open' end,
    'weekly',
    'Week ' || p.week_number,
    (v_start + ((p.week_number - 1) * 7))::date,
    1
  from public.divisions d
  join demo_fixture_plan p on true
  join demo_team_seed hs on hs.seed = p.home_seed
  join demo_team_seed aws on aws.seed = p.away_seed
  join public.teams home_team on home_team.division_id = d.id and home_team.name = hs.team_name
  join public.teams away_team on away_team.division_id = d.id and away_team.name = aws.team_name
  where d.season_id = v_season_id;

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
  join demo_team_seed hs on hs.seed = rp.home_seed
  join demo_team_seed aws on aws.seed = rp.away_seed
  join public.teams home_team on home_team.id = f.home_team_id and home_team.name = hs.team_name
  join public.teams away_team on away_team.id = f.away_team_id and away_team.name = aws.team_name
  where f.season_id = v_season_id
  on conflict (fixture_id) do update set
    home_score = excluded.home_score,
    away_score = excluded.away_score,
    winner_team_id = excluded.winner_team_id,
    notes = excluded.notes,
    status = excluded.status,
    confirmed_at = excluded.confirmed_at;

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
  select
    v_season_id,
    d.id,
    t.id,
    0,
    0,
    0,
    0,
    0,
    0
  from public.divisions d
  join public.teams t on t.division_id = d.id
  where d.season_id = v_season_id
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
      public.demo_score_total(r.home_score) - public.demo_score_total(r.away_score) as home_diff
    from public.results r
    join public.fixtures f on f.id = r.fixture_id
    where f.season_id = v_season_id
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
      case when winner_team_id = home_team_id then 3 else 0 end as points
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
      case when winner_team_id = away_team_id then 3 else 0 end as points
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
  set
    played = a.played,
    won = a.won,
    drawn = a.drawn,
    lost = a.lost,
    score_diff = a.score_diff,
    points = a.points,
    updated_at = now()
  from aggregated a
  where s.season_id = a.season_id
    and s.team_id = a.team_id;

  -- Demo sponsors. Logo URLs can be replaced with uploaded sponsor logos from Admin > Sponsors.
  insert into public.sponsors (club_id, name, sponsor_type, placement, logo_url, website_url, sort_order, is_active)
  values
    (v_club_id, 'Congleton Eats', 'Demo League Sponsor', 'homepage,league,cup', null, null, 1, true),
    (v_club_id, 'PARX Mortgage & Insurance Services', 'Demo Division Sponsor', 'league,division', null, null, 2, true),
    (v_club_id, 'Congleton Town FC', 'Demo Community Partner', 'homepage,fixtures,footer', null, null, 3, true),
    (v_club_id, 'GSM Padel', 'Demo Club Sponsor', 'homepage,cup,footer', null, null, 4, true)
  on conflict do nothing;

  -- League Cup default: Top 3 from first two leagues, Top 2 from third, none from extras unless enabled by admin.
  insert into public.cup_qualifier_rules (
    season_id,
    division_id,
    qualifier_count,
    sort_order,
    is_active
  )
  select
    v_season_id,
    division_id,
    case when league_number = 3 then 2 when league_number <= 2 then 3 else 0 end,
    sort_order,
    league_number <= 3
  from (
    select
      d.id as division_id,
      d.sort_order,
      row_number() over (order by d.sort_order, d.name) as league_number
    from public.divisions d
    where d.season_id = v_season_id
  ) x
  on conflict (season_id, division_id) do update set
    qualifier_count = excluded.qualifier_count,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = now();
end;
$$;

grant execute on function public.reset_demo_data() to authenticated;
grant execute on function public.load_demo_club_data() to authenticated;
grant execute on function public.demo_slug(text) to authenticated;
grant execute on function public.demo_score_total(text) to authenticated;

notify pgrst, 'reload schema';
