-- Rallora Club Onboarding Wizard support
-- Run this after the Club Settings / Multi-Club Foundation SQL has been applied.

create table if not exists public.club_setup_profiles (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  schedule_style text not null default 'weekly',
  fixtures_per_pack int not null default 3,
  win_points int not null default 3,
  draw_points int not null default 1,
  loss_points int not null default 0,
  forfeit_win_points int not null default 3,
  default_teams_per_league int not null default 8,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(club_id, season_id)
);

alter table public.club_setup_profiles enable row level security;

drop policy if exists "Admins can manage club setup profiles" on public.club_setup_profiles;
create policy "Admins can manage club setup profiles"
on public.club_setup_profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read active club setup profiles" on public.club_setup_profiles;
create policy "Public can read active club setup profiles"
on public.club_setup_profiles
for select
using (
  exists (
    select 1
    from public.clubs c
    where c.id = club_setup_profiles.club_id
      and c.is_active = true
  )
);

-- Keep the multi-club foundation columns safe if this SQL is run on a fresh copy.
alter table public.seasons add column if not exists club_id uuid references public.clubs(id) on delete cascade;
alter table public.sponsors add column if not exists club_id uuid references public.clubs(id) on delete cascade;
alter table public.announcements add column if not exists club_id uuid references public.clubs(id) on delete cascade;

create index if not exists club_setup_profiles_club_id_idx on public.club_setup_profiles(club_id);
create index if not exists club_setup_profiles_season_id_idx on public.club_setup_profiles(season_id);

notify pgrst, 'reload schema';
