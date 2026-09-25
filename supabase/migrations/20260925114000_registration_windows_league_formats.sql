alter table public.seasons
  add column if not exists registration_opens_at timestamptz,
  add column if not exists registration_closes_at timestamptz,
  add column if not exists league_format text not null default 'standard',
  add column if not exists teams_per_division integer,
  add column if not exists matches_per_cycle integer,
  add column if not exists division_assignment_mode text not null default 'manual';

alter table public.seasons drop constraint if exists seasons_league_format_check;
alter table public.seasons add constraint seasons_league_format_check check (league_format in ('standard','promotion_relegation_cycles'));
alter table public.seasons drop constraint if exists seasons_division_assignment_mode_check;
alter table public.seasons add constraint seasons_division_assignment_mode_check check (division_assignment_mode in ('manual','combined_rating'));
alter table public.seasons drop constraint if exists seasons_teams_per_division_check;
alter table public.seasons add constraint seasons_teams_per_division_check check (teams_per_division is null or teams_per_division between 2 and 100);
alter table public.seasons drop constraint if exists seasons_matches_per_cycle_check;
alter table public.seasons add constraint seasons_matches_per_cycle_check check (matches_per_cycle is null or matches_per_cycle between 1 and 100);
alter table public.seasons drop constraint if exists seasons_registration_window_check;
alter table public.seasons add constraint seasons_registration_window_check check (registration_opens_at is null or registration_closes_at is null or registration_opens_at < registration_closes_at);
