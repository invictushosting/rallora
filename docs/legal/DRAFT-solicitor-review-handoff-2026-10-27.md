# Rallora — UK legal counsel handoff and operational sign-off (DRAFT)
Date: 27 October 2026. **NOT FOR SIGNATURE OR PUBLICATION.**

## Purpose and scope
Request an independent UK solicitor review of Rallora's SaaS player and club operating model before any new legal text is shown to live users. Protego Solutions Ltd is identified in existing drafts as the operator; company identity, registered details, scope and signatory must be verified by the client. No legal opinion, policy approval or assignment of staff responsibility is recorded here.

## Proposed counsel instruction
Please review the linked drafts for UK GDPR, Data Protection Act 2018, PECR, UK consumer/e-commerce terms where relevant and the commercial pilot arrangement. Return redlines, a purpose-by-purpose controller/processor matrix, obligations and responsibilities, lawful-basis analysis, a defensible retention schedule, UK transfer analysis, a list of missing vendor DPA evidence, account/child/safeguarding terms, and precise changes needed to make them ready for publication and signature.

## Files for legal reviewer
1. `app/privacy/page.tsx` — public privacy notice, **not publishable**: roles, purposes/bases, recipients/transfers and retention incomplete.
2. `app/terms/page.tsx` — player terms, **not publishable**: ages, consumer protections, moderation, restrictions and liability unfinished.
3. `app/cookies/page.tsx` — cookie notice, **not publishable**: inventory/consent pending. Browser-storage and tracking audit is needed.
4. `docs/legal/DRAFT-club-saas-and-pilot-agreement.md` — pricing, billing, SLA, liability, governing law, signature and pilot-specific terms unresolved.
5. `docs/legal/DRAFT-data-processing-agreement.md` — Article 28 clauses and processing schedule incomplete.
6. `docs/legal/processing-inventory-working.md` — Article 30-style records, unverified lawful bases and processors.
7. `docs/legal/DRAFT-retention-and-role-mapping-2026-10-27.md` — proposed decision options **not policy**.
8. `docs/legal/DRAFT-release-approval-and-decisions-2026-10-27.md` — twelve open approval records.
9. `docs/legal/DRAFT-privacy-rights-operations-sop.md` — privacy-case workflow and responsibility gaps.

## Critical questions for counsel
- Which party determines purposes and essential means of independent user accounts, club leagues, support, billing, player discovery, Rallora Social, marketing and security?
- Which purposes have contractual necessity, legal obligation or a substantiated legitimate-interests assessment? Where is consent actually required and must it be separate from terms acceptance?
- Does any Playtomic profile/rating integration require separate permissions, terms, notices or a data-flow agreement?
- Is processing of children or junior players permitted? What safeguards and parental/club obligations would follow?
- Which consumer terms, cancellation rights, liability limits and pilot renewal rules can be justified?
- What retention periods or transparent criteria can be approved for player account, results, support, access-rights evidence, operational notifications, incident logs and backups?
- What Article 28 controller instructions, exit/deletion assistance, subprocessor changes, international transfer safeguards and incident escalation arrangements are needed?
- What consent/rejection/withdrawal mechanisms are required by the *actual* cookie and storage audit?

## Proposed operational responsibility chart — primary privacy lead nominated, others unassigned
| Role to nominate | Day-to-day duty | Backup requirement | Acceptance evidence |
|---|---|---|---|
| Protego business owner — confirmed primary operational privacy contact in project conversation, 27 October 2026; identity and mailbox access to verify | Monitor `support@rallora.app` and authenticated privacy queue each business day; triage requests; set actual due dates; route club-controlled cases | Named deputy with mailbox access | Name, agreement, inbox read/reply verification, training and duty schedule |
| Protego security/engineering lead | Review privacy notification outbox failures, worker logs, privileged access, backup/restore tests, incident response | Named technical backup | Test evidence and incident escalation |
| Club controller contact | Approve league-related rights decisions, retention and sporting records; supply verified instructions | Club deputy | Contract schedule, named contact and escalation method |
| Protego commercial contract owner | Approve plan/pilot fee, invoicing/VAT, cancellation, term and signatory | Contract delegate | Approved order form and contract version |
| Independent UK legal reviewer | Assess counsel questions, return redlines and approve/dispute release wording | Alternative reviewer or agreed procedure | Formal documented sign-off |

The business owner explicitly volunteered as primary operational privacy contact. No deputy, statutory DPO, solicitor or security role has been appointed. No privileged access, email forwarding or live workflow changes have been made.

## Day-one privacy operating controls to approve
- Confirm support mailbox can receive external messages and that owner and backup can access it. No real player data should be used for test emails.
- Open and check both email requests and restricted platform queue **every business day**; retain a separate secure access-controlled case register for all channels. Weekend/public holiday receipt must be considered in computing dates.
- Assign an actual response deadline case-by-case. A UI 21-day *internal review* marker is **not** the UK GDPR deadline. UK ICO right-of-access guidance describes a usual one-calendar-month limit, plus context-dependent identity, fees and extension rules.
- Escalate missed checks, request backlogs, failed email notifications, potential breaches and disputes immediately according to the approved incident runbook.
- Do not close a request merely because the dashboard status changed; record identity verification, actual actions, secure response and applicable legal exceptions.
- Do not trigger automatic deletion or a blanket purge from the proposed retention worksheet.
- Do not treat Resend provider acceptance as confirmation a staff member read or acted on an email.

## Required business inputs before counsel engagement
- Confirmed legal entity and actual business/controller contact.
- Signatory/decision maker and primary + deputy privacy leads (names/roles to be supplied).
- Club legal names, pilot start/end dates, agreed fee or free pilot, applicable renewal and cancellation terms.
- Reviewed list of vendors, DPAs, data regions and transfers, retention schedules and signed club instructions.
- Decisions on junior players, social/discovery visibility, marketing and Playtomic use.

## Reference guidance (checked 27 October 2026)
- ICO privacy information requirements: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/
- ICO lawful basis: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/
- ICO right of access timelines: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/right-of-access/what-should-we-consider-when-responding-to-a-request/
- ICO PECR storage and access technologies: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-we-comply-with-the-pecr-rules/

## Release conclusion
**NO-GO.** This brief solicits decisions; it does not constitute legal sign-off. Final approved terms version and existing-user journey, monitored case handling, real managed Auth / email tests and explicit release authorisation remain prerequisites.
