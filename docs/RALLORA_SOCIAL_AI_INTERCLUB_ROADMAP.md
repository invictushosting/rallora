# Rallora: Social, AI Assistant & Interclub Roadmap

Status: **approved product direction, not yet implemented**. These features must not
be mistaken for working integrations, production database migrations or paid plans.

## 1. Rallora Social & Communications

**Create once, distribute appropriately.** Club admin creates a news item, confirmed
result, weekly roundup, fixture announcement, cup update or sponsor feature. Rallora
generates destination-specific formats, previews and delivery jobs. The admin chooses
connected accounts/destinations and confirms Publish or Schedule.

Destinations: Rallora club news, connected Facebook Page, eligible Instagram
professional account, WhatsApp Business opt-in recipient communication, operator
assisted WhatsApp group/Status sharing, email digest and player/device sharing.
**Do not claim automatic WhatsApp group/Status publishing** is covered by standard
WhatsApp Business messaging. Onboarding must explain eligible Meta accounts,
permissions, account approvals and recipient consent.

Features: graphic templates using club logo/colours plus optional sponsor; separate
captions and sizes per channel; saved channel presets; publishing history and
deduplicated per-destination retries; connection health; approval and scheduling;
correction flow for changed confirmed results; opt-in/unsubscribe and privacy controls.
Start with local content studio and exported cards so Meta approvals do not block
club value. All queued jobs carry verified club_id and destination authorization,
encrypted tokens server-side, rate limits, log retention and delivery failure state.

## 2. Rallora AI Assistant (two access modes)

Public player assistant embedded in site:
- Answer from **published, club-scoped** fixtures, confirmed results, table views,
  registration info, venue details, official news and published competition rules.
- Suggest navigation and link to the underlying club page. Never invent a fixture,
  score, opponent or registration instruction when the source is missing.
- Distinguish informational answers from actions; include an obvious Contact club /
  Get help path and a no-data fallback.
- Respect chosen club and season; optionally clarify before using another club's
  published data. Allow users to opt out of chat history collection.

Authenticated club assistant, after real RLS and role-based auth are complete:
- Explain club dashboard, draft news/social captions, help with fixture communications,
  summaries from that club's authorized records, and prepare but **not auto-execute**
  write operations.
- Require user to inspect and confirm proposed schedule, result, post or notification
  before any action. Server re-checks club membership and authorization at action time.
- No browser-supplied service-role secrets, unguarded SQL access, cross-club member
  details, captain emails or private contact lists in model context.
- Use constrained server tools and safe public/member views, separate system prompt
  from database content; retrieved news/posts are untrusted data, not instructions.
  Limit spend using per-club budgets, quotas, rate limits and tier entitlement.
- Be clear an AI is responding, display important source links, log errors with
  sensible retention, provide admin disable switch, and make no claim of guaranteed
  accuracy. Avoid training model on user chats by default.

Potential natural-language examples: "When is our next Division 2 match?",
"Who is top of the published Division 1 table?", "Draft the Week 6 roundup"
and "What do I need to submit a result?".

## 3. Rallora Interclub Competitions (future, after several real clubs)

A Rallora-wide competition is NOT assigned to either club's normal seasons table;
create a platform competition layer (organiser_id, invitations, participant club_id,
qualified team roster snapshot, fixtures, scores, standings, media and permissions).
Possible formats: champions vs champions showcase, invitational cup, club-v-club
challenge, regional series, national finals and mixed standard / skill divisions.
Don't conflate two clubs' internal division numbers or rating scales.

Flows:
1. Club A invites Club B; both verified organisers explicitly accept.
2. Each club nominates a published champion or eligible roster; handle transfers,
   dropouts and tied standings with organiser confirmation.
3. Organiser selects format, dates, venue/host, costs, liability, rules and
   eligibility; roster freezes before competition.
4. Fixtures appear on both club pages and one Rallora event hub; scoped result
   submission plus two-side confirmation/dispute workflow updates the event table.
5. Rallora Social creates opt-in promotion, fixture cards, result graphics and a
   final champions post, using both club identities and sponsor permissions.

Must plan in advance: player consent and minors, permissions for multi-club event
organisers, collision/conflict of interest in confirming a result, host venue fees
and cancellations, travel/location, differing league structures, fair eligibility,
data retention and separating platform titles from local club trophies. Do not
let platform events mutate ordinary club season results.

## Delivery sequence

First close backups, real staging, tenant RLS and core league workflows. Then
implement Social content studio and manual sharing, a **read-only public club AI
assistant with source links and strict budgets**, club admin AI drafting after
authorization is complete, social OAuth/publishing, and Interclub invitations /
competition engine once multiple production clubs are onboarded. Build minimal
shared primitives now: club_id, memberships, owner consent, published views,
brand assets, verified results, content calendar/events and audit logs.

None of the above requires upgrading Vercel immediately for code changes; live
deployment may be delayed by Hobby build-rate limit. Don't silently enable billable
AI APIs, email/SMS/WhatsApp, payment providers or Vercel Pro without owner approval.
