alter table public.rallora_club_applications
  add column if not exists contact_phone text;

comment on column public.rallora_club_applications.contact_phone is
  'Applicant mobile/contact number supplied during club application.';
