-- GSM Padel production safety helpers
-- Safe to run before Vercel deployment.
-- Keeps demo/admin helper functions unavailable to anonymous users.

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'reset_demo_data'
  ) then
    execute 'revoke execute on function public.reset_demo_data() from anon';
    execute 'revoke execute on function public.reset_demo_data() from public';
    execute 'grant execute on function public.reset_demo_data() to authenticated';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'load_demo_club_data'
  ) then
    execute 'revoke execute on function public.load_demo_club_data() from anon';
    execute 'revoke execute on function public.load_demo_club_data() from public';
    execute 'grant execute on function public.load_demo_club_data() to authenticated';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'recalculate_standings_for_season'
  ) then
    execute 'revoke execute on function public.recalculate_standings_for_season(uuid) from anon';
    execute 'revoke execute on function public.recalculate_standings_for_season(uuid) from public';
    execute 'grant execute on function public.recalculate_standings_for_season(uuid) to authenticated';
  end if;
end $$;

notify pgrst, 'reload schema';
