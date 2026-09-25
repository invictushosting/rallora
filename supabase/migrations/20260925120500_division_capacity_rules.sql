alter table public.seasons
  add column if not exists max_divisions integer,
  add column if not exists allow_overflow_when_uneven boolean not null default true;

alter table public.seasons drop constraint if exists seasons_max_divisions_check;
alter table public.seasons add constraint seasons_max_divisions_check
  check (max_divisions is null or max_divisions between 1 and 100);

comment on column public.seasons.max_divisions is
  'Maximum number of divisions/groups the club wants Rallora to create when registrations close.';
comment on column public.seasons.teams_per_division is
  'Target number of teams per division/group. Auto-allocation may exceed this only when allow_overflow_when_uneven is true and registrations do not divide evenly.';
comment on column public.seasons.allow_overflow_when_uneven is
  'When true, auto-allocation may place extra teams into divisions only to handle uneven registration totals.';
