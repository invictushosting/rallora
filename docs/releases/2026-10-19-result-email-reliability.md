# Result review and email reliability

Disputes now retain the captain’s original submission notes and store the opposing captain’s reason in a separate field. The organiser dispute panel reads the reason, with a fallback for legacy disputes whose original notes were already replaced. Resubmission clears the prior dispute reason. A non-organiser assigned to both teams cannot confirm their own submission; authorised organisers retain recovery access.

The shared email sender validates recipients, applies an eight-second request timeout and retries transient connection errors, rate limits and server failures up to three total attempts. Retries reuse an idempotency key and identical body. Permanent rejection is not retried, and a Retry-After longer than five seconds is left for a later user attempt. Success requires a provider acceptance ID; acceptance is not proof of delivery to an inbox.

Enquiry notifications now use that sender and check both outcomes independently. The enquiry remains saved when notification email fails, so visitors are not asked to submit it twice. Support notification failures are logged instead of silently ignored. Test-email failures return a readable error. Dynamic HTML values are escaped in support and test emails.

Validation includes 33 JavaScript tests and synthetic SQL checks for independent captain confirmation, self-confirmation rejection, dispute reasons, original notes, organiser-only resolution, standings recovery and clean resubmission. These changes do not add a durable email retry queue or automatic captain email notifications. Live inbox delivery and a browser walkthrough using two separate captain accounts remain separate launch checks.
