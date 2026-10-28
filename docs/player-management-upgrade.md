# Player management upgrade

## Behaviour

Teams & players now offers **Swap Players**, **Add from Standby**, and **Move to Standby** for each of the existing two player slots. The old Replace control is removed. A native modal dialog gives immediate visual feedback, keyboard focus, confirmation, progress and inline errors.

The previous Replace handler set state correctly but rendered its selector after the entire competition roster, with no scroll or focus transfer. On a long GSM roster the click could appear to do nothing. Pool-load errors were also ignored. The existing replacement RPC is present in production; no live replacement was attempted during this investigation.

Swaps exchange two occupied slots in the same division. Adding standby fills the chosen vacancy or returns its current player to standby atomically. Moving out leaves an explicitly incomplete pairing. The current draft or active cycle is required; completed and superseded cycles are blocked. Available standby entries from earlier cycles of the same competition are accepted; unrelated competitions and singles are excluded.

Moved players must have registered Rallora accounts. An unclaimed player receives a clear instruction to finish account registration. This follows the existing pool schema, whose user ID is mandatory. Rating-based entry requires an incoming rating; bespoke club rules must also be checked by the administrator in the confirmation dialog. Cross-division swaps are deliberately blocked rather than inferring eligibility from free-text league rules.

Player access and registration records move together. The role associated with an occupied destination slot is preserved; filling an empty slot uses the existing Player 1 captain / Player 2 player convention. Moving a captain out does not promote their partner. Pending invitations for departing players are cancelled; their invitation history remains. Replaced partner claim links are cleared.

## Database migration

`supabase/migrations/20261028091607_player_movements_and_match_rosters.sql` adds:

- Team roster versions, incremented by a trigger, to reject stale confirmations.
- Fixture name snapshots and triggers on result/submission creation.
- An administrator-only, append-only-through-the-API movement audit with actor, timestamp, player IDs, affected slots and before/after rosters.
- The checked transactional `rallora_manage_players` RPC. Private helpers use an empty search path, explicit tenant authorization and restricted execute grants. Anonymous execution and direct API writes to the audit are denied.
- Retirement of both legacy replacement entry points for authenticated callers.

The operation uses the existing season advisory lock, season row lock, ordered team locks and invitation locks. Pool placement uses row locks and unique-key upserts. A late failure rolls back team, membership, pool and audit changes together.

Fixtures, scores, team IDs, league places and standings remain in place. Public results, captain fixtures, admin result views, search and exports use saved names for recorded matches. Upcoming fixtures use current rosters. Legacy snapshots can preserve only the roster available when introduced; earlier unrecorded substitutions cannot be reconstructed.

## Help & Guides

The existing Manage entries, divisions and players article now covers each action, full pairings, captain access, incomplete teams, future bookings, historical results, account requirements, eligibility, stale confirmations and common errors. Its existing replacement section anchor is retained for old help links.

## Verification

- JavaScript test suite: 93 passing tests, including fixture-name retention and movement help coverage.
- TypeScript: passed.
- ESLint: no errors; 17 pre-existing warnings.
- Next.js production build: passed locally with synthetic Supabase configuration and in GitHub CI.
- GitHub quality gates passed for both build and tenant-safety jobs, including the real PostgreSQL concurrency test.
- Disposable PostgreSQL-compatible database: existing SQL CI sequence plus the new production-shaped schema, migration and movement assertions pass. Checks include swaps, vacant/full standby assignments, moving out, captain access, duplicate/competition/division rejection, permissions, historical scores/names, stale confirmations, audit isolation and rollback after an injected final audit failure.
- Browser smoke tests at 1280px, 768px and 390px pass for all actions, confirmation gating, stale-error recovery, Escape and viewport fit. These use synthetic fixture props and mocked API responses; SQL behaviour is tested separately against the disposable database.
- The real two-connection PostgreSQL race test passed in GitHub CI: concurrent confirmations produced exactly one successful movement, one standby record, one audit entry and one roster-version increment.

## Release order and remaining review

This migration has **not** been applied to production. No live GSM player assignments were changed. The PR must remain unmerged until approved.

Review and apply the migration to an isolated staging database, then exercise the preview with synthetic registrations. Preview code requires the new columns/RPC; a preview connected to the unchanged live database cannot validate these workflows. Apply the reviewed migration before releasing the matching frontend. The legacy Replace RPC is revoked by this migration, so coordinate the database/frontend release and avoid a prolonged gap.

Confirm the registered-account prerequisite and restriction to same-division swaps meet GSM's operational requirements. Verify that legacy snapshots reflect the roster currently known to Rallora. Production is not ready until staging verification and explicit release approval are complete.
