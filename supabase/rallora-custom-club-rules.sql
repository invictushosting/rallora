-- Rallora Custom Club Rules support
-- Adds flexible rule sections for each club/season created through onboarding.

create table if not exists public.club_rules (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete cascade,
  rule_preset text not null default 'standard',
  score_format text,
  fixture_rules text,
  deadline_rules text,
  forfeit_rules text,
  result_submission_rules text,
  captain_confirmation_rules text,
  league_cup_rules text,
  custom_rules text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(club_id, season_id)
);

alter table public.club_rules enable row level security;

drop policy if exists "Public can read active club rules" on public.club_rules;
create policy "Public can read active club rules"
on public.club_rules
for select
using (
  exists (
    select 1
    from public.clubs c
    where c.id = club_rules.club_id
      and c.is_active = true
  )
);

drop policy if exists "Admins can manage club rules" on public.club_rules;
create policy "Admins can manage club rules"
on public.club_rules
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create index if not exists club_rules_club_id_idx on public.club_rules(club_id);
create index if not exists club_rules_season_id_idx on public.club_rules(season_id);

notify pgrst, 'reload schema';
