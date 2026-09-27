begin;
alter table public.clubs add column if not exists email_sender_name text;
update public.clubs set email_sender_name=name where email_sender_name is null;
alter table public.clubs add constraint clubs_email_sender_name_length check (email_sender_name is null or (char_length(trim(email_sender_name)) between 1 and 100));
comment on column public.clubs.email_sender_name is 'Display name used for Rallora transactional email; defaults to club name.';
commit;
