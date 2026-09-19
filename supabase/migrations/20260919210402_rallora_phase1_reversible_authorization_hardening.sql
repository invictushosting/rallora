-- Applied to Rallora Supabase on 2026-09-19; reference copy for Git history.
-- Do not re-run blindly against production.
revoke execute on function public.captain_can_access_fixture(uuid) from public, anon;
revoke execute on function public.captain_can_submit_for_fixture(uuid, uuid) from public, anon;
revoke execute on function public.current_captain_team_id() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_captain_for_team(uuid) from public, anon;
revoke execute on function public.load_onboarding_demo_data(uuid, uuid, integer, integer) from public, anon;
revoke execute on function public.ensure_rules_for_season(uuid) from public, anon, authenticated;
grant execute on function public.captain_can_access_fixture(uuid) to authenticated;
grant execute on function public.captain_can_submit_for_fixture(uuid, uuid) to authenticated;
grant execute on function public.current_captain_team_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_captain_for_team(uuid) to authenticated;
grant execute on function public.load_onboarding_demo_data(uuid, uuid, integer, integer) to authenticated;
drop policy if exists "Captains can create submissions for own fixtures" on public.result_submissions;
