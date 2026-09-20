# Rallora Social: connected publishing integration handoff

Status: **engineering plan / OFF by default**. This document is not evidence
that Facebook, Instagram, WhatsApp Business or email are connected. Never ask
organisers to paste a social account password or access token into Rallora chat.

## Integration choice: Meta Facebook Login (Page + Instagram)

For the combined Facebook Page and linked Instagram account workflow, use
Meta's Instagram API **with Facebook Login**. Require an eligible Facebook Page
and a linked Instagram professional (Business or Creator) account; personal
Instagram accounts cannot use this flow. Meta's Instagram Login is a different
flow and does not require a linked Facebook Page; don't mix those OAuth scopes.
Account-owner onboarding should explain the chosen route plainly.

Preflight for the Rallora operator, not the club:
1. Meta developer account + app/business portfolio controlled by Rallora.
2. Official Facebook Login for Business / relevant Graph API permissions,
   production redirect URI on the eventual Rallora custom domain, HTTPS, and
   app review / advanced access where required.
3. Private app secret in deployment secrets, never NEXT_PUBLIC_* or browser JS.
4. Isolated Supabase staging, verified backup and per-club session authorization.
5. Private encryption/secret-vault design and token rotation/revocation tests.
6. Test accounts plus test Page and IG professional account, **not GSM live Page**.
7. Approve a media-hosting store and graphic lifetime (Meta must fetch a
   publicly accessible HTTPS image for Instagram API publishing).

At connection time:
- Verified club owner/admin/organiser initiates from their club dashboard;
  server rechecks Auth and club membership.
- Short-lived signed OAuth state ties session user, club, requested permissions,
  nonce, exact callback URL and expiry; reject reused/mismatched state.
- Show Meta's consent screen; return to server callback over HTTPS, exchange
  short-lived code for credentials only server-side.
- Read eligible Pages/account roles, linked IG professional accounts; admin
  selects exact target account per club. Don't auto-connect every accessible Page.
- Persist non-secret connection metadata under the *same club_id* and sensitive
  credentials only in private encrypted storage, never readable by club RLS.
- Disconnect/revoke removes credentials and cancels future delivery attempts.

Publishing:
- A Rallora post may have multiple independently approved targets.
- Validate a media type for each target, recheck connection active/permission
  status at send time, and confirm post/source result still publishable.
- Store per-target idempotency key, requested media hash, external post ID,
  attempts, last error code, last attempted time and explicit final state.
- Never retry a request blindly after uncertain timeout. Reconcile external
  post state first to avoid duplicate Facebook or Instagram posts.
- Use Meta's media container/publish steps where applicable; treat queued,
  container-ready, published and rejected as distinct states.
- Instagram Stories support differs by account type; the first release
  should target standard feed graphics only. Our device-generated Story card
  is for **manual** sharing until that workflow is reviewed.

References, checked 20 September 2026:
- https://www.postman.com/meta/instagram/folder/u4g5a2a/instagram-api-with-facebook-login
- https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api

## WhatsApp: two separate experiences

A) Sharing to a club's existing WhatsApp group or Status is operator-assisted.
   Rallora prepares caption, media and share-sheet/link, then the organiser
   chooses a destination in WhatsApp. **Do not present this as an automatic
   WhatsApp group/Status API integration.**

B) WhatsApp Business Platform API is outbound messages to opted-in recipients.
   Requires a Meta Business portfolio, WABA, suitable phone number and API
   access. Outside eligible customer-service conversations, template
   authorisation and messaging category rules apply. Collect and log recipient
   opt-in (club, channel, wording, origin and date), support unsubscribe,
   template/language, suppression lists, delivery webhooks and cost caps.
   No recipients from league captain contact details without consent.
   Store PII under stricter data minimisation / role restrictions than
   publicly visible league data. Costs must be owner-approved before activation.

References, checked 20 September 2026:
- https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api
- https://www.postman.com/meta/whatsapp-business-platform/folder/lczy75a/templates

## Email

Use a verified sending domain (SPF, DKIM and DMARC); verified recipients and
per-club opt-in; bounce / unsubscribe and suppression handling. No production
bulk mail before the owner approves a provider, costs and privacy review.

## Launch / activation checklist

- [ ] Full PostgreSQL + Auth + Storage backup and tested restore.
- [ ] Separate isolated staging connected to Preview.
- [ ] Apply draft SQL and exercise real Supabase RLS and Auth JWT tests.
- [ ] Harden all platform/club permissions, captain data and Social consent.
- [ ] Approve provider app and required scopes; configure exact redirect URIs.
- [ ] Store tokens encrypted privately, rotate and revoke in tests.
- [ ] Publish to test Pages/accounts with user confirmation.
- [ ] Replay webhooks, simulate timeouts/retries and confirm no duplicate posts.
- [ ] Record Instagram media rejection, Meta disconnect and WhatsApp opt-out UX.
- [ ] Review usage and billing limits; approve production rollout explicitly.
- [ ] Only then enable opt-in feature flags and delivery job workers.
