-- GSM Padel sponsor image/link support
-- Safe to run more than once.

alter table public.sponsors
  add column if not exists placement text not null default 'homepage',
  add column if not exists logo_url text,
  add column if not exists website_url text;

notify pgrst, 'reload schema';
