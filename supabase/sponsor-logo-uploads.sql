-- GSM Padel sponsor logo uploads via Supabase Storage

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'sponsor-logos',
  'sponsor-logos',
  true,
  1048576,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view sponsor logos" on storage.objects;
create policy "Public can view sponsor logos"
on storage.objects
for select
using (bucket_id = 'sponsor-logos');

drop policy if exists "Admins can upload sponsor logos" on storage.objects;
create policy "Admins can upload sponsor logos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'sponsor-logos' and public.is_admin());

drop policy if exists "Admins can update sponsor logos" on storage.objects;
create policy "Admins can update sponsor logos"
on storage.objects
for update
to authenticated
using (bucket_id = 'sponsor-logos' and public.is_admin())
with check (bucket_id = 'sponsor-logos' and public.is_admin());

drop policy if exists "Admins can delete sponsor logos" on storage.objects;
create policy "Admins can delete sponsor logos"
on storage.objects
for delete
to authenticated
using (bucket_id = 'sponsor-logos' and public.is_admin());
