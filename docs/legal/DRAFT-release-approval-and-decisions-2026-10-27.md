# Rallora legal and operational release sign-off pack — 27 October 2026

**Decision: NOT APPROVED FOR PUBLICATION, EXECUTION OR PRODUCTION DEPLOYMENT.** This register tracks unanswered questions and necessary evidence. It is not legal advice and no owner or sign-off is implied.

## External legal handoff
The review brief and *unassigned* operational responsibility matrix are in `docs/legal/DRAFT-solicitor-review-handoff-2026-10-27.md`. It identifies all source drafts, counsel questions, business inputs, and required acceptance evidence. No privacy lead, deputy or solicitor has been appointed or approved through this document.

## Source drafts / release scope
- Player notice: `app/privacy/page.tsx`
- Player terms: `app/terms/page.tsx`
- Cookie notice: `app/cookies/page.tsx`
- Club SaaS + pilot agreement: `docs/legal/DRAFT-club-saas-and-pilot-agreement.md`
- Article 28 club DPA: `docs/legal/DRAFT-data-processing-agreement.md`
- Processing inventory: `docs/legal/processing-inventory-working.md`
- Operational rights requests: `docs/legal/DRAFT-privacy-rights-operations-sop.md`
- Release runbook: `docs/legal/compliance-release-runbook-2026-10-27.md`

## Working decision worksheet
`docs/legal/DRAFT-retention-and-role-mapping-2026-10-27.md` contains proposed role allocations and possible retention review approaches, grounded in read-only schema evidence. **These are not approved policy or deletion timers.** LEG-02, LEG-06 and LEG-09 remain OPEN pending named business leads, club controller instructions and counsel review.

## Required decisions (all OPEN until evidence + responsible person's approval)

| ID | Approval owner / accountable role (to nominate) | Question and evidence required | Blocks |
|---|---|---|---|
| LEG-01 | Protego company decision-maker + UK privacy counsel | Validate Protego's exact legal entity and address, contact and any DPO/UK representative necessity; confirm privacy inbox staffed | Notices + contracts |
| LEG-02 | Provider and club controller contacts + privacy counsel | Map controller/processor/any joint roles across account, league administration, results, support, billing, player discovery and Rallora Social; log written instructions | Privacy notice + DPA |
| LEG-03 | Provider privacy counsel | For each controller processing purpose establish and document correct lawful basis; distinguish necessary service terms from optional marketing consent | Privacy notice |
| LEG-04 | Engineering + privacy counsel | Inventory actual cookies, local storage, third-party scripts and analytics across unauthenticated and signed-in journeys, purposes and expiry; define consent/cookie-reject controls where required | Cookies |
| LEG-05 | Engineering + procurement + privacy counsel | Verify actual suppliers (Supabase, Vercel, Resend, Google Workspace, any logging/analytics/payment/integration provider), contracts, region, onward transfers and UK transfer mechanisms; not assumed from hosting alone | Privacy notice + DPA |
| LEG-06 | Provider privacy lead + clubs + counsel | Set explicit active/inactive account, league, results, support, data subject rights, audit/event and backup retention + disposal periods; legal holds and club export/return on exit | Privacy notice + DPA + release |
| LEG-07 | Club pilot owners + commercial lead + counsel | Complete plans, trial start/end, price/VAT, renewal, cancellation, SLA/support, liability/indemnities, governing law, logo publicity rights and signatories; zero-cost pilot cannot become charged without affirmative agreement | Club agreement |
| LEG-08 | Product lead + safeguarding/privacy counsel | Approve minimum age, any juniors/safeguarding controls, user-generated content/moderation, player photos/social visibility, sporting disputes, appeals and Playtomic integration rights | Terms + notice |
| LEG-09 | Privacy lead + backup (to nominate) | Verify access to support@rallora.app, staffed queue reviews and missed-mail escalation, identity procedure, service response timelines, secure exports/deletions and incident/breach process | Privacy requests |
| LEG-10 | Engineering lead + security reviewer | Independently assess worker-token RPC execution grants, outbox failures, Resend idempotency, endpoint schedule and no sensitive data leaks; exercise real Auth and mail via isolated environment | Notification deploy |
| LEG-11 | Product + privacy counsel | Finalise Terms publication version/hash and recorded acceptance wording, renewal process for existing accounts and version mismatch policies; distinguish contract acceptance from GDPR consent | Signup release |
| LEG-12 | Release owner + DBA/security | Obtain restorable backup, non-production Auth test environment, migration rehearsal, rollback drill, production smoke checklist and explicit authorisation | Deploy |

## Sign-off evidence template (copy for each ID)
- Decision ID:
- Owner name / role:
- Approved resolution:
- Evidence link / document / vendor DPA:
- Legal reviewer:
- Date / timezone:
- Accepted residual risk and mitigation:
- Status: OPEN / BLOCKED / APPROVED

## Release order after all approvals
1. Finish privacy inventory, subprocessor and retention schedules and obtain signed legal review.
2. Generate final immutable Terms version/hash and update all three registration paths, acceptance trigger and existing-user renewal design consistently. Run negative acceptance tests.
3. Confirm privacy lead and backup with daily queue monitoring; complete delivery failure alert procedure.
4. Verify real Supabase Auth + Resend flows with synthetic users before any production change.
5. Compare production schema, record backup + recovery evidence, update runbook migration order and obtain explicit release approval.
6. Deploy in controlled sequence and record smoke-test outcomes; monitor failed outbox rows and response due dates.

## Externally published guidance checked
- ICO, right to be informed checklist: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/
- ICO, contracts between controllers and processors: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/contracts/
- ICO, responding to data subject access requests (updated Dec 2025): https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/right-of-access/what-should-we-consider-when-responding-to-a-request/

**Deadline caution:** the dashboard's internal 21-day marker is not the UK GDPR statutory deadline. ICO guidance describes the usual SAR response requirement as without undue delay and at the latest one calendar month from the relevant receipt event, subject to specific rules on identity, fee and permitted extensions. Human review is required; never calculate the legal deadline solely from the dashboard marker.

**No publication, legal sign-off, product billing decision, or live deployment is authorised by this document.**
