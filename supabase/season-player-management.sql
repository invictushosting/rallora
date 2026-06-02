-- GSM Padel League Hub: season setup + player names + captain fields
-- Run this once in Supabase SQL Editor after applying the update.

alter table public.teams
  add column if not exists player_one_name text,
  add column if not exists player_two_name text,
  add column if not exists captain_email text,
  add column if not exists is_active boolean not null default true;

-- Make sure existing teams stay active.
update public.teams
set is_active = true
where is_active is null;

-- Keep these policies idempotent so the script is safe to run more than once.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admins can manage seasons" on public.seasons;
create policy "Admins can manage seasons"
on public.seasons
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage divisions" on public.divisions;
create policy "Admins can manage divisions"
on public.divisions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage teams" on public.teams;
create policy "Admins can manage teams"
on public.teams
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage standings" on public.standings;
create policy "Admins can manage standings"
on public.standings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

notify pgrst, 'reload schema';
