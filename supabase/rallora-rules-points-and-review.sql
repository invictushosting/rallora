-- Rallora Rules Points + Review Support
-- Safe to run more than once. Adds missing points/tie-breaker fields to club rules.

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

alter table public.club_rules add column if not exists win_points int not null default 3;
alter table public.club_rules add column if not exists draw_points int not null default 1;
alter table public.club_rules add column if not exists loss_points int not null default 0;
alter table public.club_rules add column if not exists forfeit_win_points int not null default 3;
alter table public.club_rules add column if not exists forfeit_loss_points int not null default 0;
alter table public.club_rules add column if not exists double_forfeit_points int not null default 0;
alter table public.club_rules add column if not exists standings_tiebreaker text not null default 'Points, wins, score difference, score for, head-to-head, alphabetical';

update public.club_rules
set
  win_points = coalesce(win_points, 3),
  draw_points = coalesce(draw_points, 1),
  loss_points = coalesce(loss_points, 0),
  forfeit_win_points = coalesce(forfeit_win_points, 3),
  forfeit_loss_points = coalesce(forfeit_loss_points, 0),
  double_forfeit_points = coalesce(double_forfeit_points, 0),
  standings_tiebreaker = coalesce(nullif(standings_tiebreaker, ''), 'Points, wins, score difference, score for, head-to-head, alphabetical'),
  updated_at = now();

notify pgrst, 'reload schema';
