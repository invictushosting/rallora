-- Remove the remaining email-backed global admin authority without breaking
-- legacy callers. Platform administration is keyed by auth.uid().

begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.rallora_is_platform_admin();
$$;

revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- These functions intentionally bypass RLS for authorization lookups or
-- controlled maintenance. Lock object resolution to fully-qualified names.
alter function public.current_captain_team_id() set search_path = '';
alter function public.is_captain_for_team(uuid) set search_path = '';
alter function public.captain_can_access_fixture(uuid) set search_path = '';
alter function public.captain_can_submit_for_fixture(uuid, uuid) set search_path = '';
alter function public.load_onboarding_demo_data(uuid, uuid, integer, integer) set search_path = '';
alter function public.recalculate_standings_for_season(uuid) set search_path = '';

-- Evaluate JWT helpers once per statement instead of once per candidate row.
drop policy if exists "Admins can read own admin record" on public.admin_users;
create policy "Admins can read own admin record"
on public.admin_users for select to authenticated
using (
  (select auth.uid()) is not null
  and lower(email) = lower((select auth.jwt()) ->> 'email')
);

drop policy if exists "Captain can read own record" on public.captain_users;
create policy "Captain can read own record"
on public.captain_users for select to authenticated
using (
  (
    (select auth.uid()) is not null
    and lower(email) = lower((select auth.jwt()) ->> 'email')
  )
  or public.rallora_is_platform_admin()
);

drop policy if exists "Captains can read own captain record" on public.team_captains;
create policy "Captains can read own captain record"
on public.team_captains for select to authenticated
using (
  (select auth.uid()) is not null
  and lower(email) = lower((select auth.jwt()) ->> 'email')
);

-- These overlap the narrower captain/manager policies and are unnecessary.
drop policy if exists "Admins can manage submissions" on public.result_submissions;
drop policy if exists "Captains can read own submissions" on public.result_submissions;

commit;
