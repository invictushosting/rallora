# Match actions for both team members

Both current roster members can open the Match centre at the established `/clubs/[slug]/captain` address. The captain role remains the main team contact; partners retain the `player` role and must claim their own team invitation.

All four fixture players can propose/agree times and record, update or remove an agreed court booking. Recording a booking does not reserve a court. Either teammate can submit one result. Either opposing player can confirm it once or dispute it with a note. A teammate cannot approve their own team's submission. Organisers retain result recovery and correction permissions.

The database checks the authenticated identity against the fixture's current club, season and pairing. Draft, completed, superseded and locked fixtures reject player result changes. Submitted and disputed results cannot be overwritten by another teammate. Direct result table mutations are revoked from browser roles. Existing RPC names are retained for deployed clients. Result notes remain separate from dispute reasons.

Booking and result actions append an actor/time entry to `rallora_fixture_player_actions`, with fixture-scoped read access. Result reviews also record `reviewed_by_user_id` and `reviewed_at`. Existing data and player roles are not rewritten. Existing custom club rule text is not rewritten; default rules and Help & Guides describe the new permissions.

Result notices, fixture publication notices and configured reminders include both linked members. Confirmation reminders target only opponents. Club channel preferences, quiet hours, delivery deduplication and account preferences remain in force. This release does not send a bulk announcement or reinvite players.

## Verification

- `npm test`: player/captain login destinations, result view state, invitation wording and existing application regression coverage.
- `npm run lint`, `npm run typecheck`, `npm run build` with CI dummy Supabase configuration.
- `scripts/staging/ci_all_player_match_actions_assertions.sql`: synthetic authenticated-role booking, partner submission/confirmation/dispute, own-team and outsider denial, duplicate suppression, official results/standings, notification recipients, reminder targeting, action attribution, direct-write denial, removed-player denial and completed-cycle denial.
- The tenant-safety CI job applies this migration and runs these assertions after the existing tenant and league regressions. Local verification uses the same SQL files in an embedded PostgreSQL runtime; GitHub CI uses PostgreSQL 17.

## Release

Apply `supabase/migrations/20261106081243_all_player_match_actions.sql` to Rallora, verify function grants/RLS and then release this branch through the normal GitHub/Vercel path. No fixture, result, division or membership data changes are required. Verify the released Match centre and a linked partner account before announcing availability.

For rollback, restore the previously deployed application and restore the original result RPCs from `20261019094049_result_review_audit_trail.sql`, and booking/conversation functions from `20261029081850_fixture_playing_window.sql`. Restore notification/reminder functions from `20261021123430_configurable_notifications_and_competition_end.sql` and `20261021125005_precise_reminder_windows.sql` (the non-message reminder function is now named `fixture_reminder_relevant`). Remove `fixture_players_read_submissions` to withdraw partner result reads. Retain audit records/columns and the direct-write restriction; restoring unsafe browser result writes is unnecessary. Do not delete player results created under this release.
