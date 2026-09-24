begin;
alter table public.rallora_club_applications
  add column if not exists applicant_name text;
alter table public.rallora_club_applications
  drop constraint if exists rallora_club_applications_applicant_name_check;
alter table public.rallora_club_applications
  add constraint rallora_club_applications_applicant_name_check
  check (applicant_name is null or (char_length(trim(applicant_name)) between 2 and 120));
commit;
