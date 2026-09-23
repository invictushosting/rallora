begin;

alter table public.rallora_club_events
  drop constraint if exists rallora_club_events_format_check;

alter table public.rallora_club_events
  add constraint rallora_club_events_format_check
  check(format in ('americano','mexicano','climb_courts','custom'));

commit;
