insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('club-media','club-media',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
set public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Club managers can select club media" on storage.objects;
create policy "Club managers can select club media" on storage.objects
for select to authenticated
using (
  bucket_id='club-media'
  and (
    exists (
      select 1 from public.rallora_club_memberships m
      where m.club_id::text=(storage.foldername(name))[1]
        and m.user_id=(select auth.uid())
        and m.status='active'
        and m.role in ('owner','admin','organiser')
    )
    or exists (
      select 1 from public.rallora_platform_admins p
      where p.user_id=(select auth.uid())
    )
  )
);

drop policy if exists "Club managers can upload club media" on storage.objects;
create policy "Club managers can upload club media" on storage.objects
for insert to authenticated
with check (
  bucket_id='club-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (
    exists (
      select 1 from public.rallora_club_memberships m
      where m.club_id::text=(storage.foldername(name))[1]
        and m.user_id=(select auth.uid())
        and m.status='active'
        and m.role in ('owner','admin','organiser')
    )
    or exists (
      select 1 from public.rallora_platform_admins p
      where p.user_id=(select auth.uid())
    )
  )
);

drop policy if exists "Club managers can update club media" on storage.objects;
create policy "Club managers can update club media" on storage.objects
for update to authenticated
using (
  bucket_id='club-media'
  and (
    exists (
      select 1 from public.rallora_club_memberships m
      where m.club_id::text=(storage.foldername(name))[1]
        and m.user_id=(select auth.uid())
        and m.status='active'
        and m.role in ('owner','admin','organiser')
    )
    or exists (
      select 1 from public.rallora_platform_admins p
      where p.user_id=(select auth.uid())
    )
  )
)
with check (
  bucket_id='club-media'
  and (
    exists (
      select 1 from public.rallora_club_memberships m
      where m.club_id::text=(storage.foldername(name))[1]
        and m.user_id=(select auth.uid())
        and m.status='active'
        and m.role in ('owner','admin','organiser')
    )
    or exists (
      select 1 from public.rallora_platform_admins p
      where p.user_id=(select auth.uid())
    )
  )
);

drop policy if exists "Club managers can delete club media" on storage.objects;
create policy "Club managers can delete club media" on storage.objects
for delete to authenticated
using (
  bucket_id='club-media'
  and (
    exists (
      select 1 from public.rallora_club_memberships m
      where m.club_id::text=(storage.foldername(name))[1]
        and m.user_id=(select auth.uid())
        and m.status='active'
        and m.role in ('owner','admin','organiser')
    )
    or exists (
      select 1 from public.rallora_platform_admins p
      where p.user_id=(select auth.uid())
    )
  )
);
