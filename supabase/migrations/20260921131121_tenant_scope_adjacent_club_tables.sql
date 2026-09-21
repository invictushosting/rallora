-- Tenant-scope the remaining club content and competition support tables.
-- Public reads remain available only for active/published competition data.

begin;

-- Remove global-admin and unscoped public policies.
drop policy if exists "Admins can manage announcements" on public.announcements;
drop policy if exists "Public can read published announcements" on public.announcements;
drop policy if exists "Admins can manage sponsors" on public.sponsors;
drop policy if exists "Public can read active sponsors" on public.sponsors;
drop policy if exists "Admins can manage standings" on public.standings;
drop policy if exists "Public can read standings" on public.standings;
drop policy if exists "Admins can manage club rules" on public.club_rules;
drop policy if exists "Public can read active club rules" on public.club_rules;
drop policy if exists "Public can read club rules" on public.club_rules;
drop policy if exists "Admins can manage club setup profiles" on public.club_setup_profiles;
drop policy if exists "Public can read active club setup profiles" on public.club_setup_profiles;
drop policy if exists "Admins can manage cup qualifier rules" on public.cup_qualifier_rules;
drop policy if exists "Public can read cup qualifier rules" on public.cup_qualifier_rules;
drop policy if exists "Admins can manage cup manual qualifiers" on public.cup_manual_qualifiers;
drop policy if exists "Public can read cup manual qualifiers" on public.cup_manual_qualifiers;

alter table public.announcements enable row level security;
alter table public.sponsors enable row level security;
alter table public.standings enable row level security;
alter table public.club_rules enable row level security;
alter table public.club_setup_profiles enable row level security;
alter table public.cup_qualifier_rules enable row level security;
alter table public.cup_manual_qualifiers enable row level security;

-- Announcements
create policy "tenant_announcements_anon_read" on public.announcements
for select to anon using (is_published and exists (
  select 1 from public.clubs c where c.id=club_id and c.is_active
));
create policy "tenant_announcements_authenticated_read" on public.announcements
for select to authenticated using (
  (is_published and exists (select 1 from public.clubs c where c.id=club_id and c.is_active))
  or public.rallora_can_manage_club(club_id)
);
create policy "tenant_announcements_insert" on public.announcements
for insert to authenticated with check (club_id is not null and public.rallora_can_manage_club(club_id));
create policy "tenant_announcements_update" on public.announcements
for update to authenticated using (public.rallora_can_manage_club(club_id))
with check (club_id is not null and public.rallora_can_manage_club(club_id));
create policy "tenant_announcements_delete" on public.announcements
for delete to authenticated using (public.rallora_can_manage_club(club_id));

-- Sponsors
create policy "tenant_sponsors_anon_read" on public.sponsors
for select to anon using (is_active and exists (
  select 1 from public.clubs c where c.id=club_id and c.is_active
));
create policy "tenant_sponsors_authenticated_read" on public.sponsors
for select to authenticated using (
  (is_active and exists (select 1 from public.clubs c where c.id=club_id and c.is_active))
  or public.rallora_can_manage_club(club_id)
);
create policy "tenant_sponsors_insert" on public.sponsors
for insert to authenticated with check (club_id is not null and public.rallora_can_manage_club(club_id));
create policy "tenant_sponsors_update" on public.sponsors
for update to authenticated using (public.rallora_can_manage_club(club_id))
with check (club_id is not null and public.rallora_can_manage_club(club_id));
create policy "tenant_sponsors_delete" on public.sponsors
for delete to authenticated using (public.rallora_can_manage_club(club_id));

-- Club rules: a season-specific row must stay inside the same club.
create policy "tenant_club_rules_anon_read" on public.club_rules
for select to anon using (
  exists (select 1 from public.clubs c where c.id=club_id and c.is_active)
  and (season_id is null or exists (
    select 1 from public.seasons s where s.id=public.club_rules.season_id
      and s.club_id=public.club_rules.club_id
      and s.status in ('active','completed')
  ))
);
create policy "tenant_club_rules_authenticated_read" on public.club_rules
for select to authenticated using (
  (exists (select 1 from public.clubs c where c.id=club_id and c.is_active)
   and (season_id is null or exists (
     select 1 from public.seasons s where s.id=public.club_rules.season_id
       and s.club_id=public.club_rules.club_id
       and s.status in ('active','completed')
   ))) or public.rallora_can_manage_club(club_id)
);
create policy "tenant_club_rules_insert" on public.club_rules
for insert to authenticated with check (
  public.rallora_can_manage_club(club_id)
  and (season_id is null or exists (
    select 1 from public.seasons s where s.id=public.club_rules.season_id
      and s.club_id=public.club_rules.club_id
  ))
);
create policy "tenant_club_rules_update" on public.club_rules
for update to authenticated using (public.rallora_can_manage_club(club_id))
with check (
  public.rallora_can_manage_club(club_id)
  and (season_id is null or exists (
    select 1 from public.seasons s where s.id=public.club_rules.season_id
      and s.club_id=public.club_rules.club_id
  ))
);
create policy "tenant_club_rules_delete" on public.club_rules
for delete to authenticated using (public.rallora_can_manage_club(club_id));

-- Onboarding/setup profiles use the same club/season invariant.
create policy "tenant_setup_profiles_anon_read" on public.club_setup_profiles
for select to anon using (
  exists (select 1 from public.clubs c where c.id=club_id and c.is_active)
  and (season_id is null or exists (
    select 1 from public.seasons s where s.id=public.club_setup_profiles.season_id
      and s.club_id=public.club_setup_profiles.club_id
      and s.status in ('active','completed')
  ))
);
create policy "tenant_setup_profiles_authenticated_read" on public.club_setup_profiles
for select to authenticated using (
  (exists (select 1 from public.clubs c where c.id=club_id and c.is_active)
   and (season_id is null or exists (
     select 1 from public.seasons s where s.id=public.club_setup_profiles.season_id
       and s.club_id=public.club_setup_profiles.club_id
       and s.status in ('active','completed')
   ))) or public.rallora_can_manage_club(club_id)
);
create policy "tenant_setup_profiles_insert" on public.club_setup_profiles
for insert to authenticated with check (
  public.rallora_can_manage_club(club_id)
  and (season_id is null or exists (
    select 1 from public.seasons s where s.id=public.club_setup_profiles.season_id
      and s.club_id=public.club_setup_profiles.club_id
  ))
);
create policy "tenant_setup_profiles_update" on public.club_setup_profiles
for update to authenticated using (public.rallora_can_manage_club(club_id))
with check (
  public.rallora_can_manage_club(club_id)
  and (season_id is null or exists (
    select 1 from public.seasons s where s.id=public.club_setup_profiles.season_id
      and s.club_id=public.club_setup_profiles.club_id
  ))
);
create policy "tenant_setup_profiles_delete" on public.club_setup_profiles
for delete to authenticated using (public.rallora_can_manage_club(club_id));

-- Standings must keep season, division and team on one tenant path.
create policy "tenant_standings_anon_read" on public.standings
for select to anon using (exists (
  select 1 from public.seasons s
  join public.clubs c on c.id=s.club_id
  join public.divisions d on d.season_id=s.id
  join public.teams t on t.division_id=d.id
  where s.id=season_id and d.id=division_id and t.id=team_id
    and s.status in ('active','completed') and c.is_active
));
create policy "tenant_standings_authenticated_read" on public.standings
for select to authenticated using (
  exists (
    select 1 from public.seasons s
    join public.clubs c on c.id=s.club_id
    join public.divisions d on d.season_id=s.id
    join public.teams t on t.division_id=d.id
    where s.id=season_id and d.id=division_id and t.id=team_id
      and s.status in ('active','completed') and c.is_active
  ) or public.rallora_can_manage_season(season_id)
);
create policy "tenant_standings_insert" on public.standings
for insert to authenticated with check (
  public.rallora_can_manage_season(season_id) and exists (
    select 1 from public.divisions d join public.teams t on t.division_id=d.id
    where d.id=division_id and d.season_id=season_id and t.id=team_id
  )
);
create policy "tenant_standings_update" on public.standings
for update to authenticated using (public.rallora_can_manage_season(season_id))
with check (
  public.rallora_can_manage_season(season_id) and exists (
    select 1 from public.divisions d join public.teams t on t.division_id=d.id
    where d.id=division_id and d.season_id=season_id and t.id=team_id
  )
);
create policy "tenant_standings_delete" on public.standings
for delete to authenticated using (public.rallora_can_manage_season(season_id));

-- Automatic cup qualifiers: division and season must agree.
create policy "tenant_cup_rules_anon_read" on public.cup_qualifier_rules
for select to anon using (is_active and exists (
  select 1 from public.divisions d
  join public.seasons s on s.id=d.season_id
  join public.clubs c on c.id=s.club_id
  where d.id=division_id and s.id=season_id
    and s.status in ('active','completed') and c.is_active
));
create policy "tenant_cup_rules_authenticated_read" on public.cup_qualifier_rules
for select to authenticated using (
  (is_active and exists (
    select 1 from public.divisions d
    join public.seasons s on s.id=d.season_id
    join public.clubs c on c.id=s.club_id
    where d.id=division_id and s.id=season_id
      and s.status in ('active','completed') and c.is_active
  )) or public.rallora_can_manage_season(season_id)
);
create policy "tenant_cup_rules_insert" on public.cup_qualifier_rules
for insert to authenticated with check (
  public.rallora_can_manage_season(season_id)
  and exists (select 1 from public.divisions d where d.id=division_id and d.season_id=season_id)
);
create policy "tenant_cup_rules_update" on public.cup_qualifier_rules
for update to authenticated using (public.rallora_can_manage_season(season_id))
with check (
  public.rallora_can_manage_season(season_id)
  and exists (select 1 from public.divisions d where d.id=division_id and d.season_id=season_id)
);
create policy "tenant_cup_rules_delete" on public.cup_qualifier_rules
for delete to authenticated using (public.rallora_can_manage_season(season_id));

-- Manual cup qualifiers: the selected team must belong to the same season.
create policy "tenant_manual_qualifiers_anon_read" on public.cup_manual_qualifiers
for select to anon using (is_active and exists (
  select 1 from public.teams t
  join public.divisions d on d.id=t.division_id
  join public.seasons s on s.id=d.season_id
  join public.clubs c on c.id=s.club_id
  where t.id=team_id and s.id=season_id
    and s.status in ('active','completed') and c.is_active
));
create policy "tenant_manual_qualifiers_authenticated_read" on public.cup_manual_qualifiers
for select to authenticated using (
  (is_active and exists (
    select 1 from public.teams t
    join public.divisions d on d.id=t.division_id
    join public.seasons s on s.id=d.season_id
    join public.clubs c on c.id=s.club_id
    where t.id=team_id and s.id=season_id
      and s.status in ('active','completed') and c.is_active
  )) or public.rallora_can_manage_season(season_id)
);
create policy "tenant_manual_qualifiers_insert" on public.cup_manual_qualifiers
for insert to authenticated with check (
  public.rallora_can_manage_season(season_id) and exists (
    select 1 from public.teams t join public.divisions d on d.id=t.division_id
    where t.id=team_id and d.season_id=season_id
  )
);
create policy "tenant_manual_qualifiers_update" on public.cup_manual_qualifiers
for update to authenticated using (public.rallora_can_manage_season(season_id))
with check (
  public.rallora_can_manage_season(season_id) and exists (
    select 1 from public.teams t join public.divisions d on d.id=t.division_id
    where t.id=team_id and d.season_id=season_id
  )
);
create policy "tenant_manual_qualifiers_delete" on public.cup_manual_qualifiers
for delete to authenticated using (public.rallora_can_manage_season(season_id));

commit;
