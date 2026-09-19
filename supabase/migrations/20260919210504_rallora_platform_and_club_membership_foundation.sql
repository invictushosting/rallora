-- Applied to Rallora Supabase on 2026-09-19; reference copy for Git history.
-- Additive identity groundwork, does NOT replace legacy global admin policies.
create table if not exists public.rallora_platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.rallora_club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'organiser')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);
create index if not exists rallora_club_memberships_user_idx on public.rallora_club_memberships (user_id);
create index if not exists rallora_club_memberships_club_idx on public.rallora_club_memberships (club_id);
alter table public.rallora_platform_admins enable row level security;
alter table public.rallora_club_memberships enable row level security;
revoke all on table public.rallora_platform_admins from public, anon;
revoke all on table public.rallora_club_memberships from public, anon;
grant select on table public.rallora_platform_admins to authenticated;
grant select on table public.rallora_club_memberships to authenticated;
drop policy if exists "Platform admins can read own identity" on public.rallora_platform_admins;
create policy "Platform admins can read own identity"
on public.rallora_platform_admins for select to authenticated
using (user_id = (select auth.uid()));
drop policy if exists "Club members can read their memberships" on public.rallora_club_memberships;
create policy "Club members can read their memberships"
on public.rallora_club_memberships for select to authenticated
using (user_id = (select auth.uid()));
drop policy if exists "Platform admins can read club memberships" on public.rallora_club_memberships;
create policy "Platform admins can read club memberships"
on public.rallora_club_memberships for select to authenticated
using (exists(select 1 from public.rallora_platform_admins pa where pa.user_id = (select auth.uid())));
insert into public.rallora_platform_admins (user_id)
select u.id from auth.users u
join public.admin_users a on lower(a.email)=lower(u.email)
on conflict (user_id) do nothing;
insert into public.rallora_club_memberships (club_id,user_id,role,status)
select c.id,u.id,'owner','active'
from public.clubs c
cross join auth.users u
join public.admin_users a on lower(a.email)=lower(u.email)
where c.slug='gsm-padel'
on conflict (club_id,user_id) do nothing;
