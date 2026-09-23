-- Platform-admin pilot readiness report. Read-only and non-destructive.
begin;
create or replace function public.rallora_pilot_readiness_report()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_report jsonb;
begin
 if not public.rallora_is_platform_admin() then raise exception 'Not authorised'; end if;
 select jsonb_build_object(
  'active_clubs',(select count(*) from public.clubs where is_active),
  'active_seasons',(select count(*) from public.seasons where status='active'),
  'registrations',(select count(*) from public.rallora_team_registration_requests),
  'roster_memberships',(select count(*) from public.rallora_team_roster_memberships),
  'captains',(select count(*) from public.rallora_team_roster_memberships where role='captain'),
  'open_fixtures',(select count(*) from public.fixtures where status='open'),
  'submitted_fixtures',(select count(*) from public.fixtures where status='submitted'),
  'disputed_fixtures',(select count(*) from public.fixtures where status='disputed'),
  'confirmed_fixtures',(select count(*) from public.fixtures where status='confirmed'),
  'confirmed_without_result',(select count(*) from public.fixtures f where f.status='confirmed' and not exists(select 1 from public.results r where r.fixture_id=f.id and r.status in('confirmed','admin_override'))),
  'official_result_on_cancelled_fixture',(select count(*) from public.fixtures f join public.results r on r.fixture_id=f.id where f.status='cancelled' and r.status in('confirmed','admin_override')),
  'duplicate_active_seasons',(select count(*) from (select club_id from public.seasons where status='active' group by club_id having count(*)>1) x),
  'orphan_submissions',(select count(*) from public.result_submissions rs where not exists(select 1 from public.fixtures f where f.id=rs.fixture_id)),
  'standings_missing_active_teams',(select count(*) from public.teams t join public.divisions d on d.id=t.division_id join public.seasons s on s.id=d.season_id where coalesce(t.is_active,true) and s.status in('active','completed') and not exists(select 1 from public.standings st where st.season_id=s.id and st.team_id=t.id)),
  'clubs_without_admin_member',(select count(*) from public.clubs c where c.is_active and not exists(select 1 from public.rallora_club_memberships m where m.club_id=c.id and m.status='active' and m.role in('owner','admin','organiser'))),
  'clubs_without_captain',(select count(*) from public.clubs c where c.is_active and not exists(select 1 from public.rallora_team_roster_memberships r where r.club_id=c.id and r.role='captain'))
 ) into v_report;
 return v_report;
end;$$;
revoke all on function public.rallora_pilot_readiness_report() from public,anon;
grant execute on function public.rallora_pilot_readiness_report() to authenticated;
commit;