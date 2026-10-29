# League planning, ratings, messaging and source reconciliation

Fixtures can be published for planning before a competition starts. Its playing window begins on the later of the fixture publication date and the season start date. Chat remains available before play begins; time proposals, proposal acceptance and recorded bookings respect the playing window. GSM's approved November playing window is 1–30 November 2026; its current early publication is retained.

All current roster members of either pairing can enter match chat, send messages, propose/respond to the opposing pairing, read their own notifications and request organiser help. Booking and results permissions stay with their existing roles. Removed players lose access. Club communication settings continue to control alerts.

Unknown ratings remain null and display **Awaiting rating**. They must not be replaced with guessed or zero values. A narrowly matched production repair restored one pairing's two missing team ratings from its approved registration without changing roster identities, fixtures or placements. Three player ratings still require values from the club. Approval rating preservation now has a real approval-path regression test.

## Guides

The late-entry guide and club-context helper fixes are included, with obsolete Replace instructions corrected to Add from Standby. Guidance now covers optional pairing names, required ratings, all-player chat access, organiser help, the difference between agreeing a time and reserving a court, early planning versus actual play, and editing league entry ratings.

## Migration provenance and deployment

`docs/production-migration-baseline-2026-10-29.json` maps every migration observed in the production ledger to a source file. Historical MCP applications often received a different version from the source filename. This map records that distinction; it does not change or repair the production ledger. The SQL for previously untracked entries is recovered from that ledger. Existing equivalent files remain mapped to their source paths. The duplicate reconsideration timestamp is replaced by its actual production identity, and the draft-placement fix is likewise aligned with production.

Do not blindly replay old migrations or run an unreviewed `db push` against this project. The repository's original baseline and staged CI schema are not a full pristine Supabase bootstrap. Migration identity mapping is evidence of source coverage, not a claim that the complete historical schema was rebuilt from an empty project.

For this release, apply **only** the new `fixture_chat_all_players` migration and then `fixture_playing_window`, in that order, after CI passes and before the frontend release. Historical migrations already applied in production require no replay. No bulk application, deletion, reseeding or fixture regeneration is part of this release.

The source incorporates work from PRs #220, #222, #233, #239 and #253. Carbon Padel and draft legal work are outside this release.

## Validation

- Unit tests, lint, TypeScript and production build with synthetic public Supabase configuration.
- Disposable SQL migration/assertion pipeline covering partners, access removal, outsiders, read cursors, role boundaries, early publication and saved approval ratings.
- PostgreSQL CI additionally runs the existing two-session movement concurrency test.
- Post-release: confirm deployed commit, migration ledger, chat access function and playing-window definitions, preserved GSM pair/fixture counts, known and missing ratings, and public guide routes.
