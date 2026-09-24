-- Synthetic PostgreSQL fixture for CI, NOT the real Rallora schema.
-- All IDs, people, and club names are invented. No production credentials/data.
-- Used only inside an ephemeral GitHub Actions Postgres container.
create role authenticated nologin;
create role anon nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $fn$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$fn$;
create function auth.jwt() returns jsonb language sql stable as $fn$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$fn$;
create function public.score_text_total(input_text text) returns integer
language sql immutable set search_path to 'pg_catalog','public' as $fn$
  select coalesce(sum((match)[1]::int),0)::int
  from regexp_matches(coalesce(input_text,''),'([0-9]+)','g') as match
$fn$;

create table public.clubs (id uuid primary key, slug text unique not null, name text not null);
create table public.seasons (
  id uuid primary key, club_id uuid not null references public.clubs(id), name text not null
);
create table public.divisions (
  id uuid primary key, season_id uuid not null references public.seasons(id), name text not null, sort_order integer not null default 1
);
create table public.teams (
  id uuid primary key default gen_random_uuid(), division_id uuid not null references public.divisions(id), name text not null,
  player_one_name text, player_two_name text, is_active boolean not null default true
);
create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id),
  division_id uuid not null references public.divisions(id),
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  week_number integer not null default 1,
  play_by date not null default current_date + 7
);
create table public.players (id uuid primary key);
create table public.team_players (id uuid primary key);
create table public.rallora_platform_admins (
  user_id uuid primary key
);
create table public.rallora_club_memberships (
  id uuid primary key,
  club_id uuid not null references public.clubs(id),
  user_id uuid not null,
  role text not null,
  status text not null
);
alter table public.rallora_platform_admins enable row level security;
alter table public.rallora_club_memberships enable row level security;
create policy "Members can see own" on public.rallora_club_memberships
  for select to authenticated using (user_id = auth.uid());
create policy "Operators can see own" on public.rallora_platform_admins
  for select to authenticated using (user_id = auth.uid());

insert into public.clubs values
('00000000-0000-0000-0000-0000000000a1','club-a','Club A'),
('00000000-0000-0000-0000-0000000000b2','club-b','Club B');
insert into public.seasons values
('00000000-0000-0000-0000-0000000001a1','00000000-0000-0000-0000-0000000000a1','Season A'),
('00000000-0000-0000-0000-0000000001b2','00000000-0000-0000-0000-0000000000b2','Season B');
insert into public.divisions values
('00000000-0000-0000-0000-0000000002a1','00000000-0000-0000-0000-0000000001a1','Division A'),
('00000000-0000-0000-0000-0000000002b2','00000000-0000-0000-0000-0000000001b2','Division B');
insert into public.teams values
('00000000-0000-0000-0000-0000000003a1','00000000-0000-0000-0000-0000000002a1','A Team 1'),
('00000000-0000-0000-0000-0000000003a2','00000000-0000-0000-0000-0000000002a1','A Team 2'),
('00000000-0000-0000-0000-0000000003b1','00000000-0000-0000-0000-0000000002b2','B Team 1'),
('00000000-0000-0000-0000-0000000003b2','00000000-0000-0000-0000-0000000002b2','B Team 2');
insert into public.fixtures values
('00000000-0000-0000-0000-0000000004a1','00000000-0000-0000-0000-0000000001a1',
 '00000000-0000-0000-0000-0000000002a1','00000000-0000-0000-0000-0000000003a1',
 '00000000-0000-0000-0000-0000000003a2'),
('00000000-0000-0000-0000-0000000004b2','00000000-0000-0000-0000-0000000001b2',
 '00000000-0000-0000-0000-0000000002b2','00000000-0000-0000-0000-0000000003b1',
 '00000000-0000-0000-0000-0000000003b2');

insert into public.rallora_club_memberships values
('00000000-0000-0000-0000-0000000005a1','00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-000000000a01','owner','active'),
('00000000-0000-0000-0000-0000000005b1','00000000-0000-0000-0000-0000000000b2',
 '00000000-0000-0000-0000-000000000b01','owner','active'),
('00000000-0000-0000-0000-0000000005a2','00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-000000000a02','organiser','suspended'),
('00000000-0000-0000-0000-0000000005a3','00000000-0000-0000-0000-0000000000a1',
 '00000000-0000-0000-0000-000000000a03','admin','active'),
('00000000-0000-0000-0000-0000000005b2','00000000-0000-0000-0000-0000000000b2',
 '00000000-0000-0000-0000-000000000b02','captain','active');
insert into auth.users(id,email) values
('00000000-0000-0000-0000-000000000999','platform@example.test'),
('11111111-1111-1111-1111-111111111111','captain-a@example.test'),
('22222222-2222-2222-2222-222222222222','captain-b@example.test');
insert into public.rallora_platform_admins values
('00000000-0000-0000-0000-000000000999');
