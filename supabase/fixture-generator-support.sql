-- GSM Padel League Hub: fixture generator support
-- Run this once if you have not already run the captain/admin policy files.
-- It refreshes the API schema and makes sure admins can manage the fixture data used by the generator.

create extension if not exists "pgcrypto";

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

-- Keep these idempotent, so it is safe to run more than once.
drop policy if exists "Admins can manage fixtures" on public.fixtures;
create policy "Admins can manage fixtures"
on public.fixtures
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage results" on public.results;
create policy "Admins can manage results"
on public.results
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

notify pgrst, 'reload schema';
