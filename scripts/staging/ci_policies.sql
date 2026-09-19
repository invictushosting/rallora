-- A real DB policy exercised in addition to the helper SQL.
-- Scoped A member must not reparent or create team rows inside club B.
alter table public.teams enable row level security;
create policy "Public fixture team reads" on public.teams
  for select to authenticated using (true);
create policy "Test scoped team update" on public.teams
  for update to authenticated
  using (public.rallora_can_manage_team(id))
  with check (public.rallora_can_manage_division(division_id));
create policy "Test scoped team insert" on public.teams
  for insert to authenticated
  with check (public.rallora_can_manage_division(division_id));
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;
grant select, insert, update on public.teams to authenticated;
grant select on public.rallora_platform_admins, public.rallora_club_memberships to authenticated;
