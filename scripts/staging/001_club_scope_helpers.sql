-- RALLORA STAGING-ONLY DRAFT. NOT A PRODUCTION MIGRATION.
-- This file deliberately lives outside supabase/migrations to prevent accidental
-- automatic application when baselining this already-running project.
-- Apply ONLY to an isolated Rallora staging project after recovery verification.
-- Helpers do not grant write access until the table policies are replaced separately.
-- Auth IDs are authoritative; do not use admin_users.email as club membership.

begin;

create or replace function public.rallora_is_platform_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.rallora_platform_admins p
      where p.user_id = auth.uid()
    );
$$;

create or replace function public.rallora_can_manage_club(p_club_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_club_id is not null
    and auth.uid() is not null
    and (
      public.rallora_is_platform_admin()
      or exists (
        select 1 from public.rallora_club_memberships m
        where m.club_id = p_club_id
          and m.user_id = auth.uid()
          and m.status = 'active'
          and m.role in ('owner', 'admin', 'organiser')
      )
    );
$$;

create or replace function public.rallora_can_manage_season(p_season_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_season_id is not null
    and exists (
      select 1 from public.seasons s
      where s.id = p_season_id
        and public.rallora_can_manage_club(s.club_id)
    );
$$;

create or replace function public.rallora_can_manage_division(p_division_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_division_id is not null
    and exists (
      select 1 from public.divisions d
      where d.id = p_division_id
        and public.rallora_can_manage_season(d.season_id)
    );
$$;

create or replace function public.rallora_can_manage_team(p_team_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_team_id is not null
    and exists (
      select 1 from public.teams t
      where t.id = p_team_id
        and public.rallora_can_manage_division(t.division_id)
    );
$$;

create or replace function public.rallora_can_manage_fixture(p_fixture_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_fixture_id is not null
    and exists (
      select 1 from public.fixtures f
      join public.divisions d on d.id = f.division_id
      where f.id = p_fixture_id
        and d.season_id = f.season_id
        and public.rallora_can_manage_season(f.season_id)
    );
$$;

revoke all on function public.rallora_is_platform_admin() from public, anon, authenticated;
revoke all on function public.rallora_can_manage_club(uuid) from public, anon, authenticated;
revoke all on function public.rallora_can_manage_season(uuid) from public, anon, authenticated;
revoke all on function public.rallora_can_manage_division(uuid) from public, anon, authenticated;
revoke all on function public.rallora_can_manage_team(uuid) from public, anon, authenticated;
revoke all on function public.rallora_can_manage_fixture(uuid) from public, anon, authenticated;

grant execute on function public.rallora_is_platform_admin() to authenticated;
grant execute on function public.rallora_can_manage_club(uuid) to authenticated;
grant execute on function public.rallora_can_manage_season(uuid) to authenticated;
grant execute on function public.rallora_can_manage_division(uuid) to authenticated;
grant execute on function public.rallora_can_manage_team(uuid) to authenticated;
grant execute on function public.rallora_can_manage_fixture(uuid) to authenticated;

commit;

-- STAGING TEST CASES (run with real test JWTs, not a service-role client):
-- A owner: can_manage_club(A) = true; can_manage_club(B) = false.
-- B owner: reverse.
-- Suspended club member: both false unless also platform admin.
-- Unauthenticated: no EXECUTE privilege on these helpers.
-- Platform admin: can_manage_club(A) and can_manage_club(B) = true.
-- Child helpers must agree on the correct club and reject non-existent IDs.
-- These are permission primitives, NOT the finished RLS migration.
