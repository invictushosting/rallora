# Player journey verification — 29 October 2026

## Findings and corrections

- The public club hub included cancelled fixtures in counts and fixture lists, and showed their cancelled booking as a request to rebook. Exclude cancelled fixtures from public data while retaining open fixtures whose court booking was cancelled. Historical database rows remain intact.
- The account page ignored provider errors in callback query parameters and fragments. Explain expired/used links, distinguish signed-in password changes from requesting a fresh recovery email, and never echo arbitrary callback descriptions.
- Support requests could remain on “Sending…” after a rejected network request. Bound the request time, release the busy state, keep the written subject/details on failure, and require explicit server acknowledgement before displaying success or clearing the form.
- Player guides now explain expired-link recovery and cancelled fixtures versus cancelled bookings.

## Evidence

- 115 application tests passed, including provider errors, network failures, malformed support responses, successful retry and cancellation semantics.
- 104 sequential SQL migration/assertion scripts passed against disposable synthetic data. These include partner invitation claims, all-player chat and proposals, captain-only bookings/results, score confirmation/disputes, standings refresh, rollover and authorisation failures.
- In the live browser, the existing super-admin session successfully opened GSM hub, Captain Centre and a fixture’s Match Centre. Current captain actions, ratings, chat, recorded-booking controls and the 1–30 November playing window rendered. No production messages, bookings or results were submitted. This was an administrative view, not a real captain or partner sign-in.
- The Match Centre had no horizontal overflow at the available 1348px desktop viewport. Browser console errors observed came from a browser extension, not Rallora.
- A fresh local browser could not complete interactive tests: the normal browser download failed earlier; the bundled alternative crashed in this environment. The cloud-browser interface did not expose viewport emulation, and device-preview keys did not change its viewport. Mobile-width and real-device verification remain incomplete.
- Live delivery queue: 286 accepted messages, six cancelled, none queued/sending/failed at inspection. Provider acceptance is not inbox delivery. Support request table had no records to inspect.
- Auth logs over the default last-24-hour window included successful logins and five invalid/expired email-link events. No new recovery email was sent and no real password was changed during verification.

## Remaining external checks

Use a real Android/iPhone browser and ordinary captain/partner accounts to complete the signed-in mobile journey. Confirm invitation and password-reset inbox delivery, and support mailbox/alias delivery with an authorised recipient. Existing DMARC and security-settings follow-up remains separate from this change.
