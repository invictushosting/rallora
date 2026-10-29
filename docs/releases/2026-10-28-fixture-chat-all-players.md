# Fixture chat for all players

Every signed-in current roster member of either fixture team can read and send messages, propose a time, accept or decline an opposing pairing’s proposal, and request organiser help. Partners use their existing player role; no captain promotion is needed. A player cannot accept their own pairing’s proposal.

Players open Match chat from their fixtures on the club hub or from their notifications. Captain Centre links remain available. Conversation labels identify participants as players. Recording court bookings and submitting results retain their existing captain/organiser permissions. The chat displays the booking form only to someone who can save it.

Message alerts now include all current fixture players, respecting existing club communication settings, quiet hours, coalescing and individual read cursors. The delivery worker rechecks current membership before sending queued alerts. Removed players lose conversation access and alert eligibility. Other players outside the fixture and anonymous visitors cannot access it. Draft conversations stay private; closed fixtures stay read-only.

## Rollout

Apply `20261028192040_fixture_chat_all_players.sql`, then deploy the app. This replaces six existing private functions while retaining their grants, the public invoker wrappers and RLS policies. No messages are sent by the migration and no player data is modified. Players must have a signed-in account linked to their approved team membership; names alone do not grant access.

## Validation

- Lint and TypeScript checks; 106 Node tests.
- Production build using synthetic CI Supabase settings.
- Full 96-script synthetic PostgreSQL-compatible PGlite pipeline, including the existing captain suite and new partner assertions. GitHub CI runs the same SQL against PostgreSQL 17.
- Partner tests cover draft denial, read/write access, sender identity, proposing and responding, rejecting same-pairing acceptance, alerts, read cursors, removal, closed fixtures, and denial of booking/organiser powers.

Production migration and deployment have not been applied by this change.
