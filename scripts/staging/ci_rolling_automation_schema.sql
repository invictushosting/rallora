-- Production-shaped columns missing from the deliberately minimal CI fixture.
alter table public.seasons
  add column if not exists starts_on date,
  add column if not exists ends_on date,
  add column if not exists fixture_schedule_mode text not null default 'date_window',
  add column if not exists registration_published boolean not null default false,
  add column if not exists registration_opens_at timestamptz,
  add column if not exists registration_closes_at timestamptz,
  add column if not exists league_format text not null default 'standard',
  add column if not exists teams_per_division integer,
  add column if not exists matches_per_cycle integer,
  add column if not exists division_assignment_mode text not null default 'manual',
  add column if not exists max_divisions integer,
  add column if not exists allow_overflow_when_uneven boolean not null default true,
  add column if not exists promotion_places integer not null default 2,
  add column if not exists relegation_places integer not null default 2,
  add column if not exists cycle_match_mode text not null default 'single_round_robin',
  add column if not exists require_cycle_completion boolean not null default true,
  add column if not exists league_rules jsonb not null default '[]';
alter table public.fixtures add column if not exists fixture_group_type text not null default 'weekly',
  add column if not exists fixture_group_name text,add column if not exists fixtures_per_team integer;
