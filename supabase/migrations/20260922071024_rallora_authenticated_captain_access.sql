-- Captains are authenticated Rallora users, never email matches.
begin;
create or replace function public.is_captain_for_team(p_team_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_team_id is not null and auth.uid() is not null and exists (
  select 1 from public.rallora_team_roster_memberships r
  where r.team_id=p_team_id and r.player_user_id=auth.uid() and r.role='captain'
 ); $$;
create or replace function public.current_captain_team_id() returns uuid
language sql stable security definer set search_path='' as $$
 select r.team_id from public.rallora_team_roster_memberships r
 where r.player_user_id=auth.uid() and r.role='captain' order by r.created_at limit 1; $$;
create or replace function public.captain_can_access_fixture(p_fixture_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.fixtures f where f.id=p_fixture_id and
  (public.is_captain_for_team(f.home_team_id) or public.is_captain_for_team(f.away_team_id))); $$;
create or replace function public.captain_can_submit_for_fixture(p_fixture_id uuid,p_team_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.fixtures f where f.id=p_fixture_id and
  (f.home_team_id=p_team_id or f.away_team_id=p_team_id) and public.is_captain_for_team(p_team_id)); $$;
alter function public.is_captain_for_team(uuid) set search_path='';
alter function public.current_captain_team_id() set search_path='';
alter function public.captain_can_access_fixture(uuid) set search_path='';
alter function public.captain_can_submit_for_fixture(uuid,uuid) set search_path='';
revoke all on function public.is_captain_for_team(uuid),public.current_captain_team_id(),public.captain_can_access_fixture(uuid),public.captain_can_submit_for_fixture(uuid,uuid) from public,anon;
grant execute on function public.is_captain_for_team(uuid),public.current_captain_team_id(),public.captain_can_access_fixture(uuid),public.captain_can_submit_for_fixture(uuid,uuid) to authenticated;
commit;
