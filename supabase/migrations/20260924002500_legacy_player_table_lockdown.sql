-- Legacy player tables are not used by the current authenticated roster workflow.
-- Keep RLS enabled and remove direct API privileges rather than inventing access policies.
begin;
revoke all on table public.players, public.team_players from anon, authenticated;
commit;