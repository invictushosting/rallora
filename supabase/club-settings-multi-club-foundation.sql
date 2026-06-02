-- GSM Padel League Hub: Club Settings + Multi-Club Foundation
-- This keeps GSM as the first club/tenant and prepares the database for future paid club accounts.

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text,
  logo_url text,
  primary_color text not null default '#2458ff',
  secondary_color text not null default '#0f172a',
  accent_color text not null default '#2458ff',
  contact_email text,
  website_url text,
  instagram_url text,
  facebook_url text,
  welcome_title text,
  welcome_text text,
  footer_text text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clubs enable row level security;

drop policy if exists "Public can read active clubs" on public.clubs;
create policy "Public can read active clubs"
on public.clubs
for select
using (is_active = true);

drop policy if exists "Admins can manage clubs" on public.clubs;
create policy "Admins can manage clubs"
on public.clubs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.clubs (
  slug,
  name,
  short_name,
  logo_url,
  primary_color,
  secondary_color,
  accent_color,
  contact_email,
  website_url,
  welcome_title,
  welcome_text,
  footer_text,
  is_active
)
values (
  'gsm-padel',
  'GSM Padel',
  'GSM',
  '/gsm-logo.png',
  '#2458ff',
  '#0f172a',
  '#2458ff',
  'info@gsmpadelclub.com',
  null,
  'GSM Padel League Hub',
  'Our club. Our league. Our passion. Manage fixtures, tables, results, teams and the League Cup in one clean mobile-first hub.',
  'Our club. Our league. Our passion.',
  true
)
on conflict (slug) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  logo_url = coalesce(public.clubs.logo_url, excluded.logo_url),
  primary_color = coalesce(public.clubs.primary_color, excluded.primary_color),
  secondary_color = coalesce(public.clubs.secondary_color, excluded.secondary_color),
  accent_color = coalesce(public.clubs.accent_color, excluded.accent_color),
  contact_email = coalesce(public.clubs.contact_email, excluded.contact_email),
  welcome_title = coalesce(public.clubs.welcome_title, excluded.welcome_title),
  welcome_text = coalesce(public.clubs.welcome_text, excluded.welcome_text),
  footer_text = coalesce(public.clubs.footer_text, excluded.footer_text),
  is_active = true,
  updated_at = now();

-- Foundation columns for future multi-club filtering. The current UI still uses GSM as the default club.
alter table public.seasons add column if not exists club_id uuid references public.clubs(id) on delete cascade;
alter table public.sponsors add column if not exists club_id uuid references public.clubs(id) on delete cascade;
alter table public.announcements add column if not exists club_id uuid references public.clubs(id) on delete cascade;

update public.seasons
set club_id = (select id from public.clubs where slug = 'gsm-padel' limit 1)
where club_id is null;

update public.sponsors
set club_id = (select id from public.clubs where slug = 'gsm-padel' limit 1)
where club_id is null;

update public.announcements
set club_id = (select id from public.clubs where slug = 'gsm-padel' limit 1)
where club_id is null;

create index if not exists seasons_club_id_idx on public.seasons(club_id);
create index if not exists sponsors_club_id_idx on public.sponsors(club_id);
create index if not exists announcements_club_id_idx on public.announcements(club_id);

-- Club logo uploads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'club-logos',
  'club-logos',
  true,
  1048576,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

drop policy if exists "Public can view club logos" on storage.objects;
create policy "Public can view club logos"
on storage.objects
for select
using (bucket_id = 'club-logos');

drop policy if exists "Admins can upload club logos" on storage.objects;
create policy "Admins can upload club logos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'club-logos' and public.is_admin());

drop policy if exists "Admins can update club logos" on storage.objects;
create policy "Admins can update club logos"
on storage.objects
for update
to authenticated
using (bucket_id = 'club-logos' and public.is_admin())
with check (bucket_id = 'club-logos' and public.is_admin());

drop policy if exists "Admins can delete club logos" on storage.objects;
create policy "Admins can delete club logos"
on storage.objects
for delete
to authenticated
using (bucket_id = 'club-logos' and public.is_admin());

notify pgrst, 'reload schema';
