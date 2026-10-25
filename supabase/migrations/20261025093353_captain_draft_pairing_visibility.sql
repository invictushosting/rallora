-- Approval creates captain membership before activation. The Captain Centre
-- embeds teams and seasons; both must be readable without publishing the draft.
-- Membership is organiser-controlled. This grants SELECT only for own pairings.
create policy "tenant_teams_captain_read"
on public.teams for select to authenticated
using (id in (
  select team_id from public.rallora_team_roster_memberships
  where player_user_id = (select auth.uid()) and role = 'captain'
));

create policy "tenant_seasons_captain_read"
on public.seasons for select to authenticated
using (id in (
  select season_id from public.rallora_team_roster_memberships
  where player_user_id = (select auth.uid()) and role = 'captain'
));
