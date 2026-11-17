-- Phase 2: apply ONLY AFTER the compatible frontend has been deployed.
-- Public sporting rows remain; stored player and match values are unchanged.
begin;

-- RLS selects rows, not columns. Remove both table-wide and any column grants.
revoke select on public.teams from public, anon, authenticated;
revoke select (captain_email,player_one_email,player_two_email) on public.teams from public,anon,authenticated;
grant select (id,division_id,name,player_one_name,player_two_name,
 is_active,player_one_rating,player_two_rating,player_one_rating_source,player_two_rating_source,
 roster_version)
 on public.teams to anon,authenticated;

revoke select on public.fixtures from public,anon,authenticated;
revoke select (court,booking_starts_at,booking_ends_at,booking_court) on public.fixtures from public,anon,authenticated;
grant select (id,season_id,division_id,week_number,home_team_id,away_team_id,play_by,status,
 fixture_group_name,available_from,arrangement_status,
 booking_type,booking_matched_players,home_player_names,away_player_names)
 on public.fixtures to anon,authenticated;

-- Existing scoped arrangement/chat/management RPCs retain their access.
notify pgrst,'reload schema';
commit;
