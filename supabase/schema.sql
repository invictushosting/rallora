-- GSM Padel League Hub database starter
-- Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.divisions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  name text not null,
  sort_order int not null default 1,
  created_at timestamptz not null default now(),
  unique(season_id, name)
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references public.divisions(id) on delete cascade,
  name text not null,
  captain_player_id uuid references public.players(id),
  created_at timestamptz not null default now(),
  unique(division_id, name)
);

create table if not exists public.team_players (
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  role text not null default 'player' check (role in ('captain', 'player')),
  primary key (team_id, player_id)
);

create table if not exists public.fixtures (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  week_number int not null,
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  play_by date not null,
  court text,
  status text not null default 'open' check (status in ('open', 'submitted', 'confirmed', 'disputed', 'forfeit', 'double_forfeit')),
  created_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null unique references public.fixtures(id) on delete cascade,
  submitted_by uuid references public.players(id),
  confirmed_by uuid references public.players(id),
  home_score text,
  away_score text,
  winner_team_id uuid references public.teams(id),
  notes text,
  status text not null default 'submitted' check (status in ('submitted', 'confirmed', 'disputed', 'admin_override')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sponsor_type text,
  website_url text,
  logo_url text,
  sort_order int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Starter seed data
insert into public.seasons (name, status, starts_on, ends_on)
values ('Spring 2025', 'active', '2025-04-01', '2025-07-31')
on conflict do nothing;

-- Basic public read policy starter. Tighten this before launch.
alter table public.seasons enable row level security;
alter table public.divisions enable row level security;
alter table public.players enable row level security;
alter table public.teams enable row level security;
alter table public.team_players enable row level security;
alter table public.fixtures enable row level security;
alter table public.results enable row level security;
alter table public.announcements enable row level security;
alter table public.sponsors enable row level security;

create policy "Public can read seasons" on public.seasons for select using (true);
create policy "Public can read divisions" on public.divisions for select using (true);
create policy "Public can read teams" on public.teams for select using (true);
create policy "Public can read fixtures" on public.fixtures for select using (true);
create policy "Public can read results" on public.results for select using (true);
create policy "Public can read published announcements" on public.announcements for select using (is_published = true);
create policy "Public can read active sponsors" on public.sponsors for select using (is_active = true);

-- Admin/captain write policies should be added once auth roles are confirmed.
