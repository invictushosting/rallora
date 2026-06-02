-- GSM Padel League Cup admin controls
-- Adds automatic qualification rules per league/division and optional manual qualifiers.

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

alter table public.cup_qualifier_rules enable row level security;
alter table public.cup_manual_qualifiers enable row level security;

drop policy if exists "Public can read cup qualifier rules" on public.cup_qualifier_rules;
create policy "Public can read cup qualifier rules"
on public.cup_qualifier_rules
for select
using (true);

drop policy if exists "Public can read cup manual qualifiers" on public.cup_manual_qualifiers;
create policy "Public can read cup manual qualifiers"
on public.cup_manual_qualifiers
for select
using (true);

drop policy if exists "Admins can manage cup qualifier rules" on public.cup_qualifier_rules;
create policy "Admins can manage cup qualifier rules"
on public.cup_qualifier_rules
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage cup manual qualifiers" on public.cup_manual_qualifiers;
create policy "Admins can manage cup manual qualifiers"
on public.cup_manual_qualifiers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Seed default rules for every active season if no rules exist yet:
-- first league top 3, second league top 3, third league top 2.
insert into public.cup_qualifier_rules (
  season_id,
  division_id,
  qualifier_count,
  sort_order,
  is_active
)
select
  d.season_id,
  d.id,
  case when row_number() over (partition by d.season_id order by d.sort_order, d.name) = 3 then 2 else 3 end,
  d.sort_order,
  case when row_number() over (partition by d.season_id order by d.sort_order, d.name) <= 3 then true else false end
from public.divisions d
where exists (
  select 1 from public.seasons s where s.id = d.season_id and s.status = 'active'
)
and not exists (
  select 1 from public.cup_qualifier_rules r where r.season_id = d.season_id
)
on conflict (season_id, division_id) do nothing;

notify pgrst, 'reload schema';
