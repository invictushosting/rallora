alter table public.seasons
  add column if not exists promotion_places integer not null default 2,
  add column if not exists relegation_places integer not null default 2,
  add column if not exists cycle_match_mode text not null default 'single_round_robin',
  add column if not exists require_cycle_completion boolean not null default true;

alter table public.seasons drop constraint if exists seasons_promotion_places_check;
alter table public.seasons add constraint seasons_promotion_places_check
  check (promotion_places between 0 and 20);

alter table public.seasons drop constraint if exists seasons_relegation_places_check;
alter table public.seasons add constraint seasons_relegation_places_check
  check (relegation_places between 0 and 20);

alter table public.seasons drop constraint if exists seasons_cycle_match_mode_check;
alter table public.seasons add constraint seasons_cycle_match_mode_check
  check (cycle_match_mode in ('single_round_robin','double_round_robin'));

comment on column public.seasons.promotion_places is
  'Number of teams promoted from each eligible group at the end of a rolling cycle.';
comment on column public.seasons.relegation_places is
  'Number of teams relegated from each eligible group at the end of a rolling cycle.';
comment on column public.seasons.cycle_match_mode is
  'single_round_robin = play each opponent once; double_round_robin = play each opponent twice.';
comment on column public.seasons.require_cycle_completion is
  'When true, the next rolling cycle cannot be generated until all current-cycle fixtures are completed and movement is resolved.';
