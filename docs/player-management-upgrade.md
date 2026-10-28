# Player management upgrade

## Behaviour

Teams & players now offers **Swap Players**, **Add from Standby**, and **Move to Standby** for each of the existing two player slots. The old Replace control is removed. A native modal dialog gives immediate visual feedback, keyboard focus, confirmation, progress and inline errors.

The previous Replace handler set state correctly but rendered its selector after the entire competition roster, with no scroll or focus transfer. On a long GSM roster the click could appear to do nothing. Pool-load errors were also ignored. The existing replacement RPC is present in production; no live replacement was attempted during this investigation.

Swaps exchange two occupied slots in the same division. Adding standby fills the chosen vacancy or returns its current player to standby atomically. Moving out leaves an explicitly incomplete pairing. The current draft or active cycle is required; completed and superseded cycles are blocked. Available standby entries from earlier cycles of the same competition are accepted; unrelated competitions and singles are excluded.

Players can be swapped and moved to or from standby without creating or claiming a Rallora account. Independent roster identities preserve each league player, including name-only entries. Existing accounts remain linked where available; a movement does not create a login. Club administrators still need authorised sign-in access. Rating-based entry requires an incoming rating; bespoke club rules must also be checked by the administrator in the confirmation dialog. Cross-division swaps are deliberately blocked rather than inferring eligibility from free-text league rules.

Player access and registration records move together. The role associated with an occupied destination slot is preserved; filling an empty slot uses the existing Player 1 captain / Player 2 player convention. Moving a captain out does not promote their partner. Pending invitations for departing players are cancelled; their invitation history remains. Replaced partner claim links are cleared.

## Database migration

`supabase/migrations/20261028091607_player_movements_and_match_rosters.sql` adds:

- Team roster versions, incremented by a trigger, to reject stale confirmations.
- Fixture name snapshots and triggers on result/submission creation.
- An administrator-only, append-only-through-the-API movement audit with actor, timestamp, player IDs, affected slots and before/after rosters.
- The checked transactional `rallora_manage_players` RPC. Private helpers use an empty search path, explicit tenant authorization and restricted execute grants. Anonymous execution and direct API writes to the audit are denied.
- Retirement of legacy replacement entry points, including the optional older manual/waitlist RPC for authenticated callers.

The operation uses the existing season advisory lock, season row lock, ordered team locks and invitation locks. Pool placement uses row locks and unique-key upserts. A late failure rolls back team, membership, pool and audit changes together.

Fixtures, scores, team IDs, league places and standings remain in place. Public results, captain fixtures, admin result views, search and exports use saved names for recorded matches. Upcoming fixtures use current rosters. Legacy snapshots can preserve only the roster available when introduced; earlier unrecorded substitutions cannot be reconstructed.

The follow-up `supabase/migrations/20261028101027_account_optional_player_movements.sql` separates league identities from accounts, permits unlinked standby entries and preserves accountless players in audit records. Owner RLS continues to require the signed-in owner; only the checked admin RPC can create unlinked movement entries. Pending invitations for departing players are cancelled. Accountless entries do not receive account-registration notifications.

Player actions and dialog buttons use explicit Rallora navy, cyan and outlined styles, consistent typography, rounded corners, focus states and mobile sizing.

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

- Additional integrated desktop/mobile verification passed with the actual component connected to the migrated SQL function in a disposable database through a test-only transport adapter. Swaps, occupied/vacant standby assignments, roster refresh, captain access, historical scores/names, stale errors and audit entries passed with no browser errors.

## Release order

Apply the reviewed migrations before releasing the matching frontend. The original upgrade retires legacy replacement RPCs, so coordinate the database/frontend release. The account-optional follow-up preserves all existing player assignments; its data updates initialise new roster identity metadata only.

Verify live help content and public league views after deployment. Test movements against disposable synthetic data, keeping live GSM assignments untouched. Confirm that historical snapshot names reflect the roster known to Rallora; unrecorded earlier substitutions cannot be reconstructed.
