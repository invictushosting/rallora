alter table public.clubs
  add column if not exists playtomic_setup_choice text;

alter table public.clubs
  drop constraint if exists clubs_playtomic_setup_choice_check;

alter table public.clubs
  add constraint clubs_playtomic_setup_choice_check
  check (playtomic_setup_choice is null or playtomic_setup_choice in ('later'));

comment on column public.clubs.playtomic_setup_choice is
  'Onboarding choice when the club does not currently have Playtomic API access. Null means undecided; later means skip for now.';
