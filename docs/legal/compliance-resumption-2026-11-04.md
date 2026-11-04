# Rallora compliance resumption — 4 November 2026

Status: DRAFT / NOT APPROVED FOR PRODUCTION.

## Verified starting point
- PR #245 was open, draft and unmerged at head `fc25ae6553c7abe6d8caec27d77cb46e388fb936`.
- That head passed GitHub Actions run #1238 / 40536007067. This confirms the previously pending run; it does not validate integration with current main.
- Current main at review: `46e59da67fdd063fcb0088714e28b6cb1bdc21e1`.
- Git merge identified conflicts in `.github/workflows/rallora-ci.yml` and `app/clubs/[slug]/register/page.tsx`.

## Integration work
- Bring current main into the existing draft branch. Preserve both privacy and current league/fixture CI checks, including separate disposable privacy and event-security jobs.
- Preserve current registration-window checks, partner-login wording and the draft affirmative terms acknowledgement.
- Correct remaining contradictory deputy requirements: owner remains sole operational privacy contact; absence/access recovery remains open for review. No deputy or access grant is implied.
- Remove Carbon Padel as an assumed pilot in the retention worksheet; start controller-role verification with confirmed GSM pilot.
- Correct runbook reference to five compliance migrations.

## Local validation
- All 126 Node tests passed, including 11 focused compliance checks.
- TypeScript passed; ESLint passed with 17 warnings and no errors.
- Production build passed with the workflow’s dummy Supabase URL/key. The first build attempt lacked these required settings and failed prerendering; the configured rerun passed. No live credentials were used.
- Legacy demo RPC scan and migration-history mapping check passed (80 production entries mapped; 101 local versions). This is a source mapping check, not a fresh database query.
- Disposable PostgreSQL jobs must pass in GitHub Actions for the refreshed commit; no local PostgreSQL service was available.

## Evidence boundaries
No production database, deployment, mailbox, user permissions or legal approval was changed. No production schema recheck, managed Auth/email test, browser journey or recovery drill was performed during this checkpoint. October schema/mailbox observations remain dated historical evidence. Later successful demo/reset emails do not establish inbound support mailbox routing or support-address reply capability.

## Ordered remaining work
1. Validate the integrated branch through fresh CI, including all disposable database jobs; retain draft status.
2. Verify correct Workspace account and support alias/group/mailbox, inspect message traces, then record independently confirmed inbound receipt and support-address reply. Gmail access is not currently available in this conversation; connection has been offered. Do not send messages or alter mail settings without authorisation.
3. Complete business facts for LEG-01/07/08: legal entity/address and ICO record, actual pilot terms, junior-player and visibility decisions. Do not invent these.
4. Collect actual supplier agreements/locations/transfers and cookie/storage evidence; reconcile inventory with fixture chat, contacts export and all-player access now present in main.
5. Complete and review role mapping, retention, DPA and notices; obtain independent legal review as required by the existing release plan. Owner-only monitoring and continuity evidence remain open.
6. Approve final immutable terms version and existing-account acceptance journey; test real managed Auth, email delivery/failures and role boundaries in a non-production environment.
7. Record restorable backup, rehearsal and rollback evidence; seek explicit production release approval only after the concrete release is ready.

None of the twelve legal decision records is closed by this checkpoint. Automated tests are technical evidence, not legal sign-off.
