# Fixture conversations and captain contacts

Captains can open Arrange match from a fixture to send private messages, propose a time, accept or decline an opponent’s proposal, and ask their organiser for help. Each conversation shows the league, division, opponents and play-by deadline. Organisers use Club admin → Match inbox to review recent conversations, filter unresolved help requests and respond under their own identity. Club admin → Captain contacts provides a league-filtered contact list and CSV download using only contact snapshots shared with that club.

An accepted time is an agreement, not a court reservation. It pre-fills the existing Record agreed booking form; a captain must book with the venue and save the booking separately. A new proposal supersedes the previous pending proposal. Changed pairings, expired times, changed playing windows and removed captains cannot accept stale proposals. Closed, draft and historical-cycle fixtures reject new messages and responses.

Messages are visible only to the current fixture captains and the club’s authorised managers, with row-level security and verified account IDs. Phone numbers are not exposed in conversations. Mutations run through invoker RPC wrappers with private, explicitly authorised transaction functions. Direct table writes and anonymous RPC calls are denied. Fixture, season and team locks serialise proposals with player changes; message UUIDs make retries idempotent. Read cursors are monotonic and cannot acknowledge an unseen future sequence. Posting is limited to ten messages per sender per fixture per minute.

Unread counts appear on captain fixtures and in the organiser inbox. Conversation pages refresh every ten seconds while visible; the inbox refreshes every fifteen seconds. Earlier messages can be loaded in batches of 100. The inbox shows the 100 most recent conversations, prioritising unresolved help requests.

The new Match conversations communication category controls email and in-app alerts. It preserves the club’s existing communication enable switch, channel choices and sending hours. New clubs remain paused by default. Alerts are coalesced to one per unread conversation; opening it acknowledges the loaded messages. Before dispatch the worker rechecks current captain/organiser access and whether any unread activity remains. Emails contain a generic activity notice and a validated fixture link, rather than private message content. No historical messages are backfilled when communications are enabled. The rollout must verify the club has enabled Match conversations and has a working delivery scheduler/provider; this change does not enable a club or send messages during installation.

## Rollout

1. Apply `20261028143810_fixture_match_conversations.sql` before deploying the frontend.
2. Deploy the matching app code. Existing captain booking and result workflows remain available.
3. In the pilot club, verify captain assignments, notification channel settings, quiet hours and the delivery scheduler.
4. Test with two pilot accounts: message, propose, accept, reserve a court externally, record the booking, and request/resolve organiser help.

## Validation

- `npm run check` with the repository’s synthetic CI Supabase URL/key.
- Full synthetic tenant/captain/communication/movement SQL pipeline, followed by the new migration and `ci_fixture_messaging_assertions.sql`.
- Browser flow with synthetic authentication and PostgreSQL-backed RPC responses; no production users, database writes or email sends.

Changes are prepared for review; applying the migration and publishing the app are separate rollout steps.
