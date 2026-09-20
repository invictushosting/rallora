-- Reversible production hardening for the legacy Rallora schema.
-- No league data is changed and no feature flag is enabled.

-- These two global-season demo routines have no application call sites and can
-- delete/rebuild the newest active season. Keep service-role access for an
-- explicit emergency recovery path, but remove browser/API execution.
revoke execute on function public.load_demo_club_data() from public, anon, authenticated;
revoke execute on function public.reset_demo_data() from public, anon, authenticated;

-- Immutable text helpers need only built-in functions. Pin resolution to
-- trusted schemas so caller-controlled search paths cannot change behaviour.
alter function public.score_text_total(text) set search_path = pg_catalog, public;
alter function public.demo_score_total(text) set search_path = pg_catalog, public;
alter function public.demo_slug(text) set search_path = pg_catalog, public;
alter function public.rallora_demo_score_total(text) set search_path = pg_catalog, public;

-- Cover every currently unindexed foreign key reported by Supabase Advisor.
create index if not exists captain_users_team_id_idx
  on public.captain_users (team_id);
create index if not exists cup_manual_qualifiers_team_id_idx
  on public.cup_manual_qualifiers (team_id);
create index if not exists cup_qualifier_rules_division_id_idx
  on public.cup_qualifier_rules (division_id);
create index if not exists fixtures_away_team_id_idx
  on public.fixtures (away_team_id);
create index if not exists fixtures_division_id_idx
  on public.fixtures (division_id);
create index if not exists fixtures_home_team_id_idx
  on public.fixtures (home_team_id);
create index if not exists result_submissions_submitting_team_id_idx
  on public.result_submissions (submitting_team_id);
create index if not exists result_submissions_winner_team_id_idx
  on public.result_submissions (winner_team_id);
create index if not exists results_confirmed_by_idx
  on public.results (confirmed_by);
create index if not exists results_submitted_by_idx
  on public.results (submitted_by);
create index if not exists results_winner_team_id_idx
  on public.results (winner_team_id);
create index if not exists standings_division_id_idx
  on public.standings (division_id);
create index if not exists standings_team_id_idx
  on public.standings (team_id);
create index if not exists team_players_player_id_idx
  on public.team_players (player_id);
create index if not exists teams_captain_player_id_idx
  on public.teams (captain_player_id);
