# Rallora owner-only privacy monitoring checklist — DRAFT (27 October 2026)

**Operational model:** Protego business owner is the sole nominated Rallora privacy contact. No deputy is nominated or implied. This is not a statutory DPO appointment. **Not active until mailbox, access and coverage controls are verified.**

## Verified mailbox checkpoint — 4 November 2026
The owner confirmed the external receive-and-reply test was completed and approved recording it in PR #245. Evidence: https://github.com/invictushosting/rallora/pull/245#issuecomment-6633360007 . Earlier failed/incomplete observations are superseded. Do not repeat the mailbox test as an outstanding requirement. No credentials, message bodies or headers are recorded here.

Queue access, daily review logs, failure escalation and owner-only continuity remain unverified. Receiving a test message does not demonstrate those separate operating controls.

## Routine owner checklist
- [ ] Every business day, open `support@rallora.app`, including requests received during weekends or holidays.
- [ ] Open restricted Rallora `/platform/privacy` after the feature is deployed, and identify open, urgent or unreviewed cases. Do not treat the UI's 21-day target as a legal deadline.
- [ ] Check failed/stale privacy notification deliveries in the approved operator report. Email-provider acceptance alone is not proof of mailbox or human receipt.
- [ ] Log new requests from **all** channels in a private restricted case register: unique case ID, channel, receipt date, accountable controller, identity verification stage, actual legal due date, status, next action and secure response record.
- [ ] For club-controlled data, contact the club controller through the agreed secure channel and record its instructions. Avoid attaching player identity documents or request contents to operational alert emails.
- [ ] Recheck imminent deadlines, unresolved identity questions, outstanding club replies and any overdue responses.
- [ ] Record daily check date/time, completion status and next action. Retain no more sensitive information than necessary.

## Temporary owner-only absence and account lockout plan — requires approval
1. Before a planned absence, identify all pending cases and deadlines and action those needing a response before the absence; do not assume a long absence pauses statutory time.
2. Keep secure account-recovery methods, MFA backup codes and the domain/Workspace recovery pathway available to the owner through an approved password manager. **No credentials or recovery codes in GitHub or case notes.**
3. If the owner cannot monitor the inbox or meet response duties, **suspend launch of the new in-app privacy intake until lawful continuity coverage is established**. For live services, consult counsel urgently on continuity/incident response; a sole-contact arrangement does not stop legal response clocks.
4. Owner to establish a time-limited external professional response/continuity arrangement if required, with a proper confidentiality agreement, access control and owner approval. None is engaged by this draft.
5. On return, reconcile inbound mailbox requests, queue requests, failed notifications and the case register, and document gaps/incidents.

## Pre-release evidence and sign-off
| Control | Owner's evidence | Status |
|---|---|---|
| Mailbox can receive and send from `support@rallora.app` | Owner-confirmed external receive/reply, recorded in PR #245 on 4 November | **COMPLETE — owner-confirmed test** |
| Sole operator has restricted admin access to privacy queue | Authenticated non-production test and production release validation | UNVERIFIED |
| Daily check habit and secure request register | Owner acceptance of checklist and restricted location | OPEN |
| Legal deadline determination and data fulfilment | Counsel-reviewed process and club controller contacts | OPEN |
| Failed-delivery detection and staff action | Monitoring query/runbook and real delivery test | OPEN |
| Holidays, illness, lockout and longer absences | Legally adequate single-person continuity plan | OPEN |
| Responsible person's written operational acceptance | Owner sign-off with date after evidence | OPEN |

**Release gate:** Do not state that incoming privacy requests are monitored or that email alerts are live until each relevant control is tested and signed off. This document does not authorise a production deployment.
