# Compliance completion checkpoint — 7 November 2026

Status: implementation and evidence advanced; NOT legally signed off or released. This record supersedes stale operational statuses in older dated checkpoints without treating proposals as approved decisions.

## Completed in this change
- Integrated current main `4e5a849ecbc9093eeb4dd138a6cda7a81378bfd2` into the existing compliance draft. Resolved conflicts preserving both-player booking/result permissions, match chat, partner login, support workspace and screenshot/email capabilities alongside affirmative signup acknowledgement.
- Preserved all four disposable database suites: tenant-safety, support-safety, privacy-migrations and public-event-security. The build job now also runs the full Node test set, covering the previously omitted compliance tests.
- Fixed the uninstalled signup migration's blanket shared-schema revoke. New tests model existing invoker callers and prove their access survives while private acceptance records remain inaccessible. Reapplying the old revoke makes the regression fail as expected.
- Recorded owner-confirmed external support-mail receive/reply COMPLETE on 4 November, correcting the release register, owner checklist and SOP. Daily monitoring/continuity remain separate open controls.
- Refreshed production metadata/security evidence: all 61 public base tables have RLS; six no-policy tables deny browser-role SELECT; support screenshots are private; compliance objects remain absent. No production mutation performed.
- Reconciled all 88 observed production migration entries to source, including the eight entries missing from the old baseline; this changes source records only and does not replay migrations.
- Extended the processing inventory for all-player match actions, chat, support search, private screenshots, ticket replies, contact exports and browser drafts.
- Completed source-level browser-storage inventory, including actual installed cookie defaults and persistent Social Studio drafts; listed required deployed-browser checks.
- Located current primary supplier DPA/transfer sources and identified the account-specific evidence still needed. No contract acceptance or supplier change is presumed.
- Added current DUAA complaint handling to the SOP and draft player/admin privacy wording: acknowledge within 30 days, investigate/keep informed/respond without undue delay; keep rights-request deadlines separate.
- Refreshed draft player privacy/terms/cookie text to cover current features and visibility questions without inventing final legal bases, consent, age rules or retention policy.
- Rechecked company identity; recorded the public confirmation-statement overdue flag for owner/accountant review. Exact ICO reference remains missing.
- Prepared `owner-decisions-for-review-2026-11-07.md` with specific factual questions, retention candidates and owner-only operating controls.

## Validation
- 132 Node tests pass, including existing support/player workflows and compliance tests.
- TypeScript passes. ESLint has no errors and 17 existing warnings.
- Disposable PGlite PostgreSQL: tenant-safety 111 SQL files; support-safety 6; privacy-migrations 10; public-event-security 3 — all pass. Local PGlite does not run Python two-session concurrency scripts; fresh GitHub PostgreSQL 17 CI must validate those.
- Old-revoke reproduction passes: the old migration removes required shared-schema USAGE and the new assertions detect it; the corrected migration passes.
- Production build passes with synthetic Supabase settings after using a checkout-local dependency directory. An initial attempt using an external node_modules symlink failed Turbopack filesystem restrictions; no application defect was indicated. Re-run final checks after final edits and record GitHub CI for the pushed head.
- No managed Supabase Auth/email, signed-in browser, restoration drill, live failure-alert test, MFA/plan inspection or complete per-function independent security review is claimed.

## Remaining decisions and evidence
| Gate | Current status | Required to close |
|---|---|---|
| LEG-01 entity/contact | Company identity/address verified; mailbox test complete; ICO user-confirmed only | Exact ICO/renewal evidence, signatory/contact, DPO/representative assessment and operating acceptance |
| LEG-02 roles | Expanded current-feature inventory and proposed role map | Provider/club activity-specific approval and written instructions |
| LEG-03 bases | Proposed basis analysis in existing drafts; not approved | Purpose-specific legal assessment, necessary contract purposes and legitimate-interest balancing/consent where appropriate |
| LEG-04 cookies | Source/dependency inventory complete | Deployed signed-in/network verification, purpose/exception decisions and any required consent controls |
| LEG-05 suppliers | Public primary terms located | Account plan/acceptance/location/retention and transfer evidence |
| LEG-06 retention | Concrete candidate schedule prepared | Owner + club/controller + counsel approval, lawful holds and tested implementation/exit approach |
| LEG-07 contracts | Free-pilot/no automatic paid conversion preserved | Actual GSM/Carbon entities, scope/dates, commercial terms, service commitments and reviewed signatures |
| LEG-08 age/visibility | Questions and specific proposal prepared | Actual age policy, public fields/basis, moderation/appeals and Playtomic authority |
| LEG-09 operations | External receive/reply COMPLETE | Daily private register/queue monitoring, fulfilment procedure and achievable owner-only continuity |
| LEG-10 notifications | Isolated SQL access/idempotency tests pass; shared-schema defect fixed | Actual managed Auth/mail/worker/failure handling in safe environment and security review |
| LEG-11 acceptance | Draft signup declaration only | Approved immutable terms/hash, existing-account/renewal journey and negative tests; never treat draft metadata as final contract acceptance |
| LEG-12 release | Integrated draft; local automated checks | Fresh PostgreSQL CI, managed Auth/browser environment, restorable backup/rehearsal, rollback evidence and concrete release decision |

## Sources and evidence locations
- `production-security-evidence-2026-11-07.md`
- `storage-and-cookie-audit-2026-11-07.md`
- `supplier-evidence-register-2026-11-07.md`
- `business-identity-check-2026-11-07.md`
- `owner-decisions-for-review-2026-11-07.md`
- Approved mailbox outcome: https://github.com/invictushosting/rallora/pull/245#issuecomment-6633360007
- ICO complaints: https://ico.org.uk/for-organisations/how-to-deal-with-data-protection-complaints/
- ICO DUAA: https://ico.org.uk/about-the-ico/what-we-do/legislation-we-cover/data-use-and-access-act-2025/the-data-use-and-access-act-2025-what-does-it-mean-for-organisations/

No production migration, public legal release, destructive retention job, paid resource or external email was performed. The existing zero-additional-cost constraint remains in place; no new Supabase project or plan was created. Do not mark unresolved gates approved merely because this checkpoint or the automated tests are complete.
