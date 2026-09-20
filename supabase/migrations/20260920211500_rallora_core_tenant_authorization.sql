-- Production tenant-authorization foundation.
-- Promoted only after the two-club synthetic role suite passed and the owner
-- confirmed an off-site roles/schema/data backup.
-- Club write feature flags remain disabled during this policy rollout.

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

-- Replace legacy global-admin policies on six core tables. The same helper and
-- policy definitions are exercised against two synthetic clubs in CI.
-- Deny public anonymous UPDATE/DELETE/INSERT, even where table GRANTs exist.
-- First remove old PERMISSIVE policies: RLS policies are ORed, not overridden.
drop policy if exists "Admins can manage clubs" on public.clubs;
drop policy if exists "Public can read active clubs" on public.clubs;
drop policy if exists "Admins can manage seasons" on public.seasons;
drop policy if exists "Public can read seasons" on public.seasons;
drop policy if exists "Admins can manage divisions" on public.divisions;
drop policy if exists "Public can read divisions" on public.divisions;
drop policy if exists "Admins can manage teams" on public.teams;
drop policy if exists "Public can read teams" on public.teams;
drop policy if exists "Admins can manage fixtures" on public.fixtures;
drop policy if exists "Public can read fixtures" on public.fixtures;
drop policy if exists "Admins can manage results" on public.results;
drop policy if exists "Public can read results" on public.results;

-- Remove earlier temporary team policies if present.
drop policy if exists "Public fixture team reads" on public.teams;
drop policy if exists "Test scoped team update" on public.teams;
drop policy if exists "Test scoped team insert" on public.teams;

alter table public.clubs enable row level security;
alter table public.seasons enable row level security;
alter table public.divisions enable row level security;
alter table public.teams enable row level security;
alter table public.fixtures enable row level security;
alter table public.results enable row level security;

create policy "tenant_clubs_public" on public.clubs for select to anon, authenticated
  using (is_active = true);
create policy "tenant_clubs_manager_read" on public.clubs for select to authenticated
  using (public.rallora_can_manage_club(id));
create policy "tenant_clubs_platform_insert" on public.clubs for insert to authenticated
  with check (public.rallora_is_platform_admin());
create policy "tenant_clubs_member_update" on public.clubs for update to authenticated
  using (public.rallora_can_manage_club(id))
  with check (public.rallora_can_manage_club(id));
create policy "tenant_clubs_platform_delete" on public.clubs for delete to authenticated
  using (public.rallora_is_platform_admin());

-- Draft seasons are only visible to an authenticated owner/organiser.
create policy "tenant_seasons_published" on public.seasons for select to anon, authenticated
  using (status in ('active','completed') and exists (
    select 1 from public.clubs c where c.id = club_id and c.is_active
  ));
create policy "tenant_seasons_member_read" on public.seasons for select to authenticated
  using (public.rallora_can_manage_club(club_id));
create policy "tenant_seasons_member_insert" on public.seasons for insert to authenticated
  with check (club_id is not null and public.rallora_can_manage_club(club_id));
create policy "tenant_seasons_member_update" on public.seasons for update to authenticated
  using (public.rallora_can_manage_club(club_id))
  with check (club_id is not null and public.rallora_can_manage_club(club_id));
create policy "tenant_seasons_member_delete" on public.seasons for delete to authenticated
  using (public.rallora_can_manage_club(club_id));

create policy "tenant_divisions_published" on public.divisions for select to anon, authenticated
  using (exists (select 1 from public.seasons s where s.id = season_id
    and s.status in ('active','completed')
    and exists (select 1 from public.clubs c where c.id=s.club_id and c.is_active)));
create policy "tenant_divisions_member_read" on public.divisions for select to authenticated
  using (public.rallora_can_manage_season(season_id));
create policy "tenant_divisions_member_insert" on public.divisions for insert to authenticated
  with check (public.rallora_can_manage_season(season_id));
create policy "tenant_divisions_member_update" on public.divisions for update to authenticated
  using (public.rallora_can_manage_season(season_id))
  with check (public.rallora_can_manage_season(season_id));
create policy "tenant_divisions_member_delete" on public.divisions for delete to authenticated
  using (public.rallora_can_manage_season(season_id));

create policy "tenant_teams_published" on public.teams for select to anon, authenticated
  using (exists (
    select 1 from public.divisions d
    join public.seasons s on s.id=d.season_id
    join public.clubs c on c.id=s.club_id
    where d.id=division_id and s.status in ('active','completed') and c.is_active
  ));
create policy "tenant_teams_member_read" on public.teams for select to authenticated
  using (public.rallora_can_manage_division(division_id));
create policy "tenant_teams_member_insert" on public.teams for insert to authenticated
  with check (public.rallora_can_manage_division(division_id));
create policy "tenant_teams_member_update" on public.teams for update to authenticated
  using (public.rallora_can_manage_division(division_id))
  with check (public.rallora_can_manage_division(division_id));
create policy "tenant_teams_member_delete" on public.teams for delete to authenticated
  using (public.rallora_can_manage_division(division_id));

-- Force season, division, and both teams to agree on ONE division.
create policy "tenant_fixtures_published" on public.fixtures for select to anon, authenticated
  using ((available_from is null or available_from <= current_date)
    and exists (
      select 1 from public.seasons s
      join public.clubs c on c.id=s.club_id
      where s.id=season_id and s.status in ('active','completed') and c.is_active
    ));
create policy "tenant_fixtures_member_read" on public.fixtures for select to authenticated
  using (public.rallora_can_manage_fixture(id));
create policy "tenant_fixtures_member_insert" on public.fixtures for insert to authenticated
  with check (
    public.rallora_can_manage_season(season_id)
    and home_team_id <> away_team_id
    and exists (
      select 1 from public.divisions d
      join public.teams h on h.division_id=d.id
      join public.teams a on a.division_id=d.id
      where d.id=public.fixtures.division_id
        and d.season_id=public.fixtures.season_id
        and h.id=public.fixtures.home_team_id
        and a.id=public.fixtures.away_team_id
    )
  );
create policy "tenant_fixtures_member_update" on public.fixtures for update to authenticated
  using (public.rallora_can_manage_fixture(id))
  with check (
    public.rallora_can_manage_season(season_id)
    and home_team_id <> away_team_id
    and exists (
      select 1 from public.divisions d
      join public.teams h on h.division_id=d.id
      join public.teams a on a.division_id=d.id
      where d.id=public.fixtures.division_id
        and d.season_id=public.fixtures.season_id
        and h.id=public.fixtures.home_team_id
        and a.id=public.fixtures.away_team_id
    )
  );
create policy "tenant_fixtures_member_delete" on public.fixtures for delete to authenticated
  using (public.rallora_can_manage_fixture(id));

create policy "tenant_results_published" on public.results for select to anon, authenticated
  using (status in ('confirmed','admin_override')
    and exists (
      select 1 from public.fixtures f
      join public.seasons s on s.id=f.season_id
      join public.clubs c on c.id=s.club_id
      where f.id=fixture_id and (f.available_from is null
        or f.available_from <= current_date)
        and s.status in ('active','completed') and c.is_active
    ));
create policy "tenant_results_member_read" on public.results for select to authenticated
  using (public.rallora_can_manage_fixture(fixture_id));
create policy "tenant_results_member_insert" on public.results for insert to authenticated
  with check (
    public.rallora_can_manage_fixture(fixture_id)
    and (winner_team_id is null or exists (
      select 1 from public.fixtures f where f.id=fixture_id
      and winner_team_id in (f.home_team_id, f.away_team_id)
    ))
  );
create policy "tenant_results_member_update" on public.results for update to authenticated
  using (public.rallora_can_manage_fixture(fixture_id))
  with check (
    public.rallora_can_manage_fixture(fixture_id)
    and (winner_team_id is null or exists (
      select 1 from public.fixtures f where f.id=fixture_id
      and winner_team_id in (f.home_team_id, f.away_team_id)
    ))
  );
create policy "tenant_results_member_delete" on public.results for delete to authenticated
  using (public.rallora_can_manage_fixture(fixture_id));
commit;
