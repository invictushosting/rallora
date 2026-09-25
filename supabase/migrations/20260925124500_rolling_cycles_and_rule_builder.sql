alter table public.seasons
  add column if not exists league_rules jsonb not null default '[]'::jsonb;

create table if not exists public.rallora_season_cycles (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  cycle_number integer not null check (cycle_number > 0),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'draft'
    check (status in ('draft','open','awaiting_results','ready_for_movement','closed')),
  previous_cycle_id uuid references public.rallora_season_cycles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (season_id, cycle_number),
  check (starts_on <= ends_on)
);

create table if not exists public.rallora_cycle_division_teams (
  cycle_id uuid not null references public.rallora_season_cycles(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  seed_position integer,
  movement text check (movement in ('promoted','relegated','stayed','new') or movement is null),
  primary key (cycle_id, team_id)
);

alter table public.fixtures add column if not exists cycle_id uuid references public.rallora_season_cycles(id) on delete set null;

create index if not exists rallora_season_cycles_season_idx on public.rallora_season_cycles(season_id,cycle_number);
create index if not exists rallora_cycle_division_teams_cycle_idx on public.rallora_cycle_division_teams(cycle_id,division_id);
create index if not exists fixtures_cycle_id_idx on public.fixtures(cycle_id);

alter table public.rallora_season_cycles enable row level security;
alter table public.rallora_cycle_division_teams enable row level security;

grant select,insert,update,delete on public.rallora_season_cycles to authenticated;
grant select,insert,update,delete on public.rallora_cycle_division_teams to authenticated;

drop policy if exists "Club managers manage season cycles" on public.rallora_season_cycles;
create policy "Club managers manage season cycles"
on public.rallora_season_cycles
for all to authenticated
using (
  exists (
    select 1 from public.seasons s
    join public.rallora_club_memberships m on m.club_id=s.club_id
    where s.id=rallora_season_cycles.season_id
      and m.user_id=(select auth.uid())
      and m.status='active'
      and m.role in ('owner','admin','organiser')
  )
  or exists (select 1 from public.rallora_platform_admins p where p.user_id=(select auth.uid()))
)
with check (
  exists (
    select 1 from public.seasons s
    join public.rallora_club_memberships m on m.club_id=s.club_id
    where s.id=rallora_season_cycles.season_id
      and m.user_id=(select auth.uid())
      and m.status='active'
      and m.role in ('owner','admin','organiser')
  )
  or exists (select 1 from public.rallora_platform_admins p where p.user_id=(select auth.uid()))
);

drop policy if exists "Club managers manage cycle memberships" on public.rallora_cycle_division_teams;
create policy "Club managers manage cycle memberships"
on public.rallora_cycle_division_teams
for all to authenticated
using (
  exists (
    select 1
    from public.rallora_season_cycles c
    join public.seasons s on s.id=c.season_id
    join public.rallora_club_memberships m on m.club_id=s.club_id
    where c.id=rallora_cycle_division_teams.cycle_id
      and m.user_id=(select auth.uid())
      and m.status='active'
      and m.role in ('owner','admin','organiser')
  )
  or exists (select 1 from public.rallora_platform_admins p where p.user_id=(select auth.uid()))
)
with check (
  exists (
    select 1
    from public.rallora_season_cycles c
    join public.seasons s on s.id=c.season_id
    join public.rallora_club_memberships m on m.club_id=s.club_id
    where c.id=rallora_cycle_division_teams.cycle_id
      and m.user_id=(select auth.uid())
      and m.status='active'
      and m.role in ('owner','admin','organiser')
  )
  or exists (select 1 from public.rallora_platform_admins p where p.user_id=(select auth.uid()))
);
