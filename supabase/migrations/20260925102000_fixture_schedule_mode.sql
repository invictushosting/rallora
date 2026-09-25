alter table public.seasons
  add column if not exists fixture_schedule_mode text not null default 'weekly';

alter table public.seasons
  drop constraint if exists seasons_fixture_schedule_mode_check;

alter table public.seasons
  add constraint seasons_fixture_schedule_mode_check
  check (fixture_schedule_mode in ('weekly','date_window'));

comment on column public.seasons.fixture_schedule_mode is
  'weekly = fixtures are organised by week number; date_window = fixtures are completed between available_from and play_by dates';

notify pgrst, 'reload schema';
