# Rallora compliance release runbook — 27 October 2026

**Release state: BLOCKED / DO NOT EXECUTE.** Reference PR #245 and issue #241. This is an operational plan, not permission to deploy. No legal draft is approved; live data and league functionality must be preserved.

## Evidence and current state
- GitHub Actions run `40517576450` / #1207: completed **success** on the then-current commit. New negative-tenant-scope fixture tests added.
- Read-only production preflight on 27 Oct: 0 of the new public privacy tables, 0 of the new public privacy admin/event predicate functions, and 0 signup acceptance triggers are installed.
- CI proves PostgreSQL fixture behaviour, not actual managed Supabase Auth sign-up/confirmation, identity verification or end-to-end club administrator access.
- In particular, `draft-2026-10-27` in the registration UI, SQL trigger and published-page drafts is **not a lawful final document version**. No deployment until final documents and version identifiers are reviewed and harmonised.
- Real production functions and RLS dependencies were reviewed read-only. `pg_net` must not be moved during this release because `rallora_private.communication_tick()` calls `net.http_post`.

## Go/no-go checklist (all required)
1. Signed-off UK privacy notice, player terms, cookie audit and club DPA; verified controller/processor activities, retention, subprocessors and cross-border transfers. Assign a named privacy rights request owner, monitored notification channel and response SLA.
2. Replace all `draft-2026-10-27` account/sign-up strings with one approved immutable document version/hash; verify use throughout paths and database trigger, including existing accounts and later renewal.
3. Confirm no scheduled or branch migrations can silently apply to production before review. Compare Supabase migration history and object presence; obtain restorable backup and agreed maintenance window.
4. Stand up **non-production Supabase project** with Auth and Data API configured like production, using **synthetic** players, clubs and administrators only. Apply migration order below. Test email confirmation, account creation failure handling, ownership, admin listing/review, and release of privacy events.
5. Test negative authentication and privileges: anonymous RPC, logged-in non-admin, player from club A, suspended admin, organiser from club B, Rallora platform admin; check public-event browse and club event scheduling; verify new rights request permissions and internal notes secrecy.
6. Validate build/typecheck/lint and legal links on preview. Test automated mail/reminders unaffected. Obtain security and legal approvals; agree rollback owner. Only then request explicit production release authorisation.

## Intended forward migration order
1. `20261027121500_signup_terms_acceptance_ledger.sql` — **only after legal version frozen**. Trigger attaches to `auth.users` and may impact signup reliability if it errors.
2. `20261027130000_privacy_rights_request_intake.sql`.
3. `20261027134500_admin_privacy_request_review.sql` (depends on the private schema and rights requests table).
4. `20261027141000_public_events_feature_routine_boundary.sql` (depends on existing club event policies and feature tables).

Migration application should use Supabase-managed migration tooling against the intended target; do not paste/run all four in production as a single blind batch.

## Post-deployment smoke tests / observability
- Anonymous user can browse published, entitled events, but not draft/cancelled or disabled/paused club events.
- Player can sign up, verify email, log in and use existing league registration flows.
- Auth account registration can produce a DB-generated terms event **for a final approved document version only**; signup without acknowledgement must not falsely log acceptance.
- Player creates a rights request and only sees their own; unauthorised users cannot read or mutate requests or notes.
- Rallora platform admin sees and updates a rights request with an audit event. Club-only organiser cannot call those RPCs. Completing a request does not imply account deletion.
- Existing fixture result entry, captain review, late team registration, club dashboards and scheduled reminders remain operational.
- No rise in signup failures, 403s, 5xx errors or delivery job failures. Monitor service logs and triage any unexpected privacy requests.

## Rollback / recovery
- **First response to a bad app release:** roll back the Vercel deployment to last-known good production SHA (record it before deploy), and stop any faulty client action. Verify server/API compatibility.
- **Do not blindly roll back database schema**: migrations may have captured real player privacy requests or acceptance events, which are records that may need legal retention. Take a secure backup/export and involve the privacy owner before cleanup.
- If a new signup trigger breaks account creation, a targeted *emergency mitigation* may be to disable/drop only that trigger after qualified DBA approval, while retaining any existing acceptance records. This is an explicitly manual decision.
- If event visibility breaks, restore the previous `published_events_public_read` RLS expression and anonymous routine EXECUTE grant under a transaction, then verify public-event browse. This temporarily restores the old security warning; risk must be acknowledged.
- Rollback of privacy intake/review database objects requires assessment of captured records, referential dependencies, and legal preservation. Do not `DROP TABLE CASCADE` or delete stored requests as an automated rollback.
- Record incident timeline, migrated versions, test results, owners and communications, especially if a personal-data breach is suspected.

## Deployment blockers currently still open
Legal approval, real Supabase Auth/staging negative tests, final versioned acceptance controls for existing users, monitored rights-request handling, subprocessor review, actual user-browser acceptance journey, and production restoration rehearsal. A passing isolated PostgreSQL CI run is necessary, not sufficient.
