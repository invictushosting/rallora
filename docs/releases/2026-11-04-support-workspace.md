# Support workspace

Player support tickets now have an admin investigation panel, searchable history,
private screenshots, invitation resends and email replies in the existing Platform
control centre. No teams, registrations, player permissions or fixtures are changed
by opening or searching a ticket.

## Admin workflow

1. Open `/platform`, then Support dashboard. Use Find a player to search by name,
   Rallora email or saved Playtomic email. Search tickets & history includes ticket
   IDs, names, email addresses, notes, recorded admin actions and reply text. Select
   All to include resolved/closed tickets. Search returns bounded results.
2. Expand a ticket. The player panel distinguishes confirmed account, pending
   invitation, roster membership and available fixtures. Refresh checks & history
   after ticket edits or the player claiming a place. Club not captured means the
   ticket omitted context; it does not mean the player has no club registration.
3. For an unclaimed invitation, verify the team and invited email. Open/copy the
   claim link or resend the existing invitation. Resending does not claim it or
   create a new registration. Captain links preselect the relevant authorized pairing in the established
   admin view; this is not authentication as the player.
4. Reply to player sends from support@rallora.app to the stored ticket address.
   The recipient cannot be changed by the browser request. Successful replies
   move an unchanged ticket to Waiting for player. A newer status change wins.
   Accepted for sending describes provider acceptance, not confirmed delivery.
5. Retry an uncertain saved reply using Retry this saved reply. The original
   message ID is reused at the provider to prevent duplicate sends. Attempts older
   than 23 hours require checking delivery before starting a new message because
   provider idempotency expires after 24 hours.
6. Activity records who changed status, priority, assignee or notes, plus message
   sender and time. Activity before this release cannot be reconstructed.

## Player form

Signed-in account email is captured server-side. Name, issue type, subject and
message are required. Known single-club/league memberships or pending invitations preselect context;
players may select Not sure. Optional screenshots accept PNG/JPEG/WebP up to 3 MB
and are stored privately. The server records page path (no query string), browser,
commit version and timestamp. Do not submit passwords or secrets. The form retains
text on failure and confirms only after the ticket is saved.

## Release requirements

- Apply `20261104134524_support_player_workspace.sql` before deploying this UI.
  The migration adds support-only columns/tables, private screenshot storage and
  narrowly restricted lookup/inbound functions. It changes no competition data.
- Existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
  `RESEND_API_KEY` are required. Missing configuration produces an explicit error.
- Replies work with the existing support mailbox while inbound threading is off.
- To thread customer email replies automatically, configure a dedicated receiving
  subdomain (for example replies.rallora.app) or the existing Resend-managed
  receiving domain, set `SUPPORT_REPLY_DOMAIN`, `RESEND_WEBHOOK_SECRET`, a separate server-only
  `RESEND_RECEIVING_API_KEY` permitted to retrieve received emails, and the
  existing server-only `SUPABASE_SERVICE_ROLE_KEY`, and subscribe an authenticated
  Resend `email.received` webhook to `https://www.rallora.app/api/support/inbound`.
  Do not replace the main domain's existing mail routing.
- The webhook verifies fresh Svix HMAC signatures against the raw payload, fetches
  content from the receiving API, matches the secret reply token and sender to the
  ticket, then atomically saves/reopens once. Wrong sender/domain/token events are
  ignored. HTML is displayed only as escaped text. Incoming attachments stay in
  the receiving mailbox and are not downloaded by this release.
- Keep the existing sending-only `RESEND_API_KEY` unchanged. Incoming content
  retrieval uses `RESEND_RECEIVING_API_KEY`; a sending-only key is rejected by the
  provider. Until receiving access is authorized and tested, keep
  `SUPPORT_REPLY_DOMAIN` empty so player replies reach the existing support inbox.
- Outbound replies use the threading address only when all inbound environment
  settings exist. Until configured, the UI explicitly says replies return to the
  support mailbox. Environment presence alone is not a verified mailbox test.

## Validation

- TypeScript, production build, existing application tests and new support tests.
- Standalone database permission tests in `support-safety`: exact/name/Playtomic
  email lookup, invite-without-account lookup, pending invite vs membership,
  admin audit identity, player/anonymous isolation, screenshot ownership,
  sender mismatch and duplicate inbound delivery.
- No customer email is sent by the tests. Complete one real support test thread
  after enabling receiving before treating automatic threading as operational.
