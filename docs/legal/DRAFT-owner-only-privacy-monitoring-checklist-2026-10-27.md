# Rallora owner-only privacy monitoring checklist — DRAFT (27 October 2026)

**Operational model:** Protego business owner is the sole nominated Rallora privacy contact. No deputy is nominated or implied. This is not a statutory DPO appointment. **Not active until mailbox, access and coverage controls are verified.**

## Current access evidence
- Connected Gmail profile verified 27 October 2026: personal Gmail account, **not** `support@rallora.app`.
- Search of connected account for messages `to:support@rallora.app` returned none. This cannot establish whether Rallora support mailbox exists, delivers mail, or is accessible in the owner's separate Workspace account.
- No mailbox passwords, forwarded mail, aliases, admin permissions, delivery rules, or production settings were changed.
- **Owner-reported mailbox test (27 October 2026):** test message to `support@rallora.app` **NOT RECEIVED**; reply from support address **NOT TESTED**. This is a failed/incomplete operational verification, not proof that DNS or mail routing is broken. Investigate recipient account, aliases/groups, spam, message trace and MX records without changing production configuration blindly.
- Required verification: owner personally opens the mailbox using the intended Workspace account; demonstrates reading an independently sent non-sensitive test message and successfully replying. Record date, headers/address used, and whether it is a group, mailbox or alias. Avoid sharing passwords or real player details.

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
| Mailbox can receive and send from `support@rallora.app` | Owner reported receive test **NO** and reply **NOT TESTED**, 27 October; re-test after diagnosis | **BLOCKED — RECEIVE FAILED; SEND NOT TESTED** |
| Sole operator has restricted admin access to privacy queue | Authenticated non-production test and production release validation | UNVERIFIED |
| Daily check habit and secure request register | Owner acceptance of checklist and restricted location | OPEN |
| Legal deadline determination and data fulfilment | Counsel-reviewed process and club controller contacts | OPEN |
| Failed-delivery detection and staff action | Monitoring query/runbook and real delivery test | OPEN |
| Holidays, illness, lockout and longer absences | Legally adequate single-person continuity plan | OPEN |
| Responsible person's written operational acceptance | Owner sign-off with date after evidence | OPEN |

**Release gate:** Do not state that incoming privacy requests are monitored or that email alerts are live until each relevant control is tested and signed off. This document does not authorise a production deployment.
