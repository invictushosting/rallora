# Privacy-rights request operations — draft SOP (27 October 2026)

**Status: DRAFT. Not an automated service and not yet live.** The Protego business owner has agreed to act as primary operational privacy contact, but the formal contact record, mailbox and admin access, deputy, coverage schedule and actual monitoring remain unverified. This is not a statutory DPO appointment.

## Intake and monitoring
- An authorised Rallora platform staff member must check the restricted `/platform/privacy` queue **every business day**, including after weekends, holiday closures and deployments.
- The queue prioritises the oldest unresolved requests and displays a **21-day internal review target**, intended to prompt action before the usual UK GDPR one-calendar-month deadline. This target does **not** calculate legal due dates, permissible extensions, pauses or exemptions.
- The back-office list returns at most 200 records. If volumes approach the cap, staff must query the restricted backend with appropriate access controls and use a separate secure tracking register. Do not assume the displayed count is the entire backlog.
- `support@rallora.app` and any other published contact channel must also be monitored for requests from people unable to sign in. Submission via email is a valid separate intake path.
- **No automatic email or alert is deployed to production for newly submitted rights requests.** A transactional notification outbox and delivery integration exist only in the draft compliance branch and require operational testing and security approval. An accountable person and backup must own monitoring until an alerting service is independently tested.

## Workflow
1. Log receipt date, originating channel, request type and case ID without copying unnecessary identity documents into unprotected notes.
2. Acknowledge receipt in an appropriate channel. Confirm whether Rallora or a club is controller for the requested processing; route club-controlled decisions through the relevant controller under the DPA.
3. Establish the actual legal deadline from the receipt date and applicable circumstances. Escalate approaching deadlines to the privacy lead; do not rely solely on the 21-day UI reminder.
4. Verify identity proportionately before disclosing or altering data. Use a controlled, secure communication channel and minimise additional data requested.
5. Identify the datasets, processors, retention obligations, exemptions, third-party information and legal consequences before acting.
6. Export/correct/restrict/erase only after scope and legal basis are checked; keep an auditable record of actions and decisions. `completed` in the dashboard is a status, **not** evidence of data export or deletion.
7. Send the response securely, recording what was completed, declined, or extended, with appropriate explanation and escalation/contact information.
8. Close the case only after documented verification and review. Apply an approved case-retention schedule to internal notes, request records and audit events.

## Daily control log
Keep date checked, operator, oldest open receipt date, count of open cases, imminent deadlines, overdue cases, escalations and action owner in a restricted organisational register. The app currently shows a live snapshot only when the page is opened.

## Release gates
Do not enable the rights-request intake for players until a named lead/backup, staffed schedule (including absences), monitored support mailbox, agreed retention policy, secure fulfilment process, and tested alerts or manual control are in operation. Obtain legal review of deadlines and controller/processor arrangements.

## Notification and monitoring implementation decision (no extra services)
The current player browser writes `rallora_privacy_requests` through authenticated RLS. A client-side best-effort email after submission would be unreliable (the browser can close), could be spoofed, and must not be treated as a delivery guarantee. Do not use it as the sole alert.

Before activating this intake, assign the platform privacy lead and backup, configure the already-published `support@rallora.app` mailbox to reach both responsible staff through the existing mail administration, and record daily queue reviews. Avoid sending request bodies, identity documents or other personal data in unprotected notification email. Draft notifications should carry only an opaque case identifier, with a restricted link to `/platform/privacy`.

A future fully automated reminder needs a durable outbox transactionally tied to request creation, a worker with retries/idempotency and backoff, scoped least-privilege delivery credentials, monitoring for failed deliveries, and end-to-end verification. Existing `rallora_private.communication_tick` handles league reminders; do not silently add privacy data to that queue or alter its service configuration.

Staff cannot claim a privacy request has been received by the responsible person merely because the row exists. The initial queue review and mailbox monitoring remain explicitly manual until an end-to-end verified notification system is deployed.

## Draft transactional notification integration (not deployed)
The proposed `20261027143000_privacy_notification_outbox.sql` migration adds one private outbox record in the same transaction as each rights-request insert. The existing scheduled `/api/internal/deliveries` endpoint claims up to five notices per invocation, sends through the existing Resend service to `support@rallora.app`, and records provider acceptance. Leases, six-attempt retry cap, exponential backoff and a stable provider idempotency key minimise duplicate notifications after timeouts. The email carries only an opaque case UUID; request contents and account identifiers are never inserted in the email body. Only acceptance by the provider is recorded, **not actual inbox delivery or human acknowledgement**.

Before launch, verify the service account's access to the new RPCs, its schedule, the sender domain and `support@rallora.app` monitored distribution, and build monitoring for outbox rows with `status='failed'` or stale `sending` leases. Existing club delivery processing must continue independently even when the privacy queue fails. Manual daily inbox/queue monitoring and an owner/backup remain required. Do not enable these migrations while the signup/legal documents remain drafts.
