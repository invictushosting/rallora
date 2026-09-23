-- Retire email-based legacy global-admin authorization.
-- Keep the legacy helper name for compatibility, but make auth.uid()-backed
-- platform administration the authoritative source.
begin;
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select public.rallora_is_platform_admin();
$$;
revoke all on function public.is_admin() from public,anon,authenticated;
grant execute on function public.is_admin() to authenticated;
commit;