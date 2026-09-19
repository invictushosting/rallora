-- Synthetic PostgreSQL fixture for CI, NOT the real Rallora schema.
-- All IDs, people, and club names are invented. No production credentials/data.
-- Used only inside an ephemeral GitHub Actions Postgres container.
create role authenticated nologin;
create role anon nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.clubs (id uuid primary key, slug text unique not null, name text not null);
create table public.seasons (
  id uuid primary key, club_id uuid not null references public.clubs(id), name text not null
);
create table public.divisions (
  id uuid primary key, season_id uuid not null references public.seasons(id), name text not null
);
create table public.teams (
  id uuid primary key, division_id uuid not null references public.divisions(id), name text not null
);
create table public.fixtures (
  id uuid primary key,
  season_id uuid not null references public.seasons(id),
  division_id uuid not null references public.divisions(id),
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id)
);
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
('00000000-0000-0000-0000-0000000005b2','00000000-0000-0000-0000-0000000000b2',
 '00000000-0000-0000-0000-000000000b02','captain','active');
insert into public.rallora_platform_admins values
('00000000-0000-0000-0000-000000000999');

-- A real DB policy exercised in addition to the helper SQL.
-- Scoped A member must not reparent or create team rows inside club B.
alter table public.teams enable row level security;
create policy "Public fixture team reads" on public.teams
  for select to authenticated using (true);
create policy "Test scoped team update" on public.teams
  for update to authenticated
  using (public.rallora_can_manage_team(id))
  with check (public.rallora_can_manage_division(division_id));
create policy "Test scoped team insert" on public.teams
  for insert to authenticated
  with check (public.rallora_can_manage_division(division_id));
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;
grant select, insert, update on public.teams to authenticated;
grant select on public.rallora_platform_admins, public.rallora_club_memberships to authenticated;
