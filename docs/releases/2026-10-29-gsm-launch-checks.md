# GSM launch checks and parallel leagues

Observed 29 October 2026. Counts can change as players claim invitations.

## Fixed launch blocker

Previously, activating any competition completed every other active competition at the same club. That would close the Winter league when GSM activated Ladies.

Independent leagues now remain active together. Activating a successor completes only its own previous round. Existing readiness, organiser authorisation and historical-cycle guards remain in place. Failed activation rolls back any predecessor status change. This migration does not activate Ladies, alter registrations, move teams or change existing results.

Club activation calls acquire the club lock before round locks. Regression coverage includes simultaneous activation of separate leagues, idempotent activation, missing readiness, unauthorised callers and direct-write protection against overlapping active rounds of one league.

## Live audit

- Winter: 44 active pairs, 11 divisions, 66 playable fixtures and one cancelled historical fixture. Playing dates are 1–30 November; fixtures are visible earlier for planning. The saved schedule ends 31 March 2027.
- Ladies: draft, 14 pairs, four divisions sized 3/4/3/4, no generated fixtures. Registration closed by timestamp on 28 October at 23:59 UTC; its publication flag remains enabled. First playing window is 2–30 November; overall finish is 1 February 2027.
- Missing Ladies ratings: Sara Dix, Lorelei darlaston and Louise Oliver. Club administrators can enter the actual ratings manually. Do not invent values or reseed the existing Winter league.
- GSM partner invitations: 27 claimed, 31 pending, two cancelled historical invitations. Every pending invitation has an email accepted by the provider; none lacks a sending record. Provider acceptance does not establish inbox delivery.
- Delivery queue: no queued, sending or failed records at audit time. No new player emails were sent during this work.

## Monthly rollover rehearsal

Disposable synthetic database, using the current migration chain:

- Independent Winter and Ladies leagues both stay active.
- Missing results block rollover; existing tests also cover disputes, submitted scores and duplicate successors.
- One-up/one-down movement, eight carried pairs and 12 generated fixtures verified in a two-division example.
- Dates cannot exceed the competition finish date; failure leaves no partial successor.
- Successor remains a private draft with the saved schedule, zeroed standings and unchanged historical fixtures.
- Both account memberships and captain/player roles carry forward; stable roster identity is retained.
- New-round chat remains accessible to both existing teammates, captain booking permissions remain assigned, and unrelated players are denied.
- Activating the new Winter round completes old Winter and leaves Ladies active.

These checks are database integration tests. Browser tests with synthetic responses must be distinguished from a real production player login and inbox test.

## Outstanding club decisions

1. Confirm whether Ladies registration should be extended and whether GSM wants two more pairs to make four full divisions.
2. Obtain the three missing ratings, then review placements before generating and activating Ladies fixtures.
3. Ask remaining partners to use their already-sent invitations. Resend only when requested or when evidence indicates a delivery problem.

## Email and security follow-up

Public DNS resolves to Namecheap nameservers. Incoming mail has a Google MX record. Resend DKIM is published, and the send subdomain resolves to a provider-managed SPF and feedback-MX configuration. No DMARC record was found. No apex SPF was found; check Google outbound mail settings and all legitimate senders before adding or changing records.

DNS does not prove that support@rallora.app and hello@rallora.app are working inboxes or aliases. Confirm both in Google Workspace and perform an authorised delivery/reply test. Support requests are stored before the optional email notification; email notification errors are logged.

Supabase security advisories include disabled leaked-password protection, pg_net installed in public, deliberately locked internal tables with no user policies, and privileged RPC exposure notices. The anonymous feature-entitlement helper returns public feature flags. Existing authenticated operations have specific access checks; do not blanket-revoke them and break the player/admin flows. Enable leaked-password protection in the Auth settings after checking plan availability, and review privileged RPCs individually.

Vercel production deployment was READY at audit time. Runtime-log retrieval returned 403; no local Vercel CLI credentials are available, so production error logs remain unverified. A failed log query must not be reported as an empty error log.

## Verification and release status

- 108 application tests passed.
- 104 sequential SQL migration/assertion scripts passed in disposable PGlite. The new parallel-league regression fails when the fix is omitted, demonstrating the previous bug.
- Lint: zero errors and 17 existing warnings. Typecheck and the production build passed.
- Added a PostgreSQL two-connection activation race test to CI; it has not run locally because a PostgreSQL server is unavailable.
- The live public club hub responded successfully. Fresh interactive mobile/desktop verification is incomplete: the browser download failed, and an alternate bundled browser could not start in this runtime. No production player login or result submission was performed.
- After the user authorised the release, production migration `20261029142212` (`concurrent_competition_activation`) was applied and verified. The installed function completes only its own predecessor and remains inaccessible to anonymous callers. Winter remains active; Ladies remains a draft.
- Ladies registration was extended by two days from 28 October 23:59 to 30 October 23:59 Europe/Dublin. The live publication/date checks confirm registration is open.
- Automatic approval review separately rejected pushing the prepared branch to `invictushosting/rallora`, requiring explicit permission for GitHub publication. Repository publication, PR/CI and frontend Help text deployment remain pending; the database fix and registration extension are live.
