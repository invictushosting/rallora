# Rallora manual-testing day: end-to-end acceptance plan

Status: **PLANNED ONLY. NOT EXECUTED.** Use this checklist on a specific agreed
date once Vercel has deployed a known `develop` commit and the test users and
isolated staging environment are ready. Do not mistake GitHub CI for hands-on UAT.

## Before anyone begins

- [ ] Record tested Git SHA and exact deployed URL. Verify the deployment contains
  that SHA; a successful GitHub build is not proof that Vercel has deployed it.
- [ ] Verify a restorable PostgreSQL + Supabase Auth + Storage backup before
  performing ANY write-path test. Finish an actual throwaway restore.
- [ ] Keep the original GSM `main` app and live club data unchanged.
- [ ] Use a separate, disposable staging Supabase database for all create/edit,
  invitation, result-submit, OAuth and delivery tests. Do not use the live shared
  database for test posts or result changes.
- [ ] Confirm staged Social SQL and real Auth/JWT RLS tests; synthetic GitHub CI
  by itself is not sufficient to enable `RALLORA_SOCIAL_DB_ENABLED`.
- [ ] Create **fictional** Club A and Club B; active owner and organiser for A,
  owner for B, suspended A user, platform admin, logged-out visitor, fake
  junior/consent-restricted player and test Page / Instagram account if ready.
- [ ] Prepare desktop Chrome/Firefox/Safari, iPhone Safari, Android Chrome,
  slow mobile connection and keyboard-only desktop. No production social
  accounts or real recipients in tests.

## Session 1: Rallora brand and club discovery

- [ ] Home renders the approved racket-R logo and links to Leagues, Social and
  Interclub; desktop/mobile menus and PWA icon are Rallora branded.
- [ ] Test `/products`, `/leagues`, `/social`, `/interclub`;
  Interclub says **future**, AI Guide says **guided navigation, not live AI**.
- [ ] Club A and Club B are visually independent. Both findable from home.
- [ ] No club should display the other club's private content, sponsors or news.
- [ ] Original GSM URL and legacy `/admin`/captain flows still behave as
  before. The separate GSM overview uses its own club records.

## Session 2: Rallora Leagues core read-only paths

- [ ] Active and completed season selector, divisions, tables, search, teams,
  fixtures, results, cup qualification and organiser-selected seeds.
- [ ] Draft seasons / future `available_from` fixtures are hidden to visitors
  AND cannot be selected by Social's result generator.
- [ ] Pending results are NOT shown as final; disputed records do not falsely
  appear as confirmed. Score corrections don't leave old published cards.
- [ ] Filters and show-all behaviour are correct after season/tab switches.
- [ ] Copy a link to a filtered season/section/division/search view, open in
  private mode and another browser, and confirm the correct public view loads.
  Invalid season/division IDs or unknown sections must be ignored rather than
  exposing another club's records.
- [ ] Check deadline language: `play_by` is a **deadline**, never marketed as
  a booked court/start time.
- [ ] Export filtered CONFIRMED results as CSV and inspect data/column order,
  UTF-8 accents, quotes, commas, and malicious formula-looking team names in
  Excel/Sheets. No personal contact information may be present.
- [ ] Download fixture deadlines as ICS; import into Apple and Google Calendar.
  Dates must be all-day play-by DEADLINES with no invented match time. Check
  team names, 29 Feb, DST weekend and Unicode.
- [ ] Check invalid/missing data and empty tables on Club A and Club B.

## Session 3: Club administration and role safety

- [ ] Logged-out visitor denied all club editing and Social Studio.
- [ ] Club A admin sees only Club A. Club B admin cannot read Club A drafts,
  fixtures under embargo or sensitive captain details.
- [ ] Suspended/revoked A member loses access even with previously saved URL.
- [ ] Platform admin can view appropriate dashboards; ordinary players can't
  impersonate operators by changing local storage or query parameters.
- [ ] Staging only: after full RLS/backup gates, exercise season/division/team/
  fixture creation, validation and denial for non-members. If club-write flag
  is still OFF, mark these **BLOCKED / NOT TESTED**, not passed.

## Session 4: Rallora Social core, manually

- [ ] Club A organiser enters news, then refreshes: draft restores only on
  that device and verified user. Switch to Club B and alternate user; the A
  draft must not appear. Clear draft removes it.
- [ ] Select confirmed match from current club. Check result text and weekly
  roundup; verify it excludes embargoed or unconfirmed scores. Deliberately
  correct source result in staging, then re-select: stale draft must not be
  silently presented as a refreshed score.
- [ ] Social result and weekly roundup captions link to the chosen
  published club season's Results view. GSM links should open its overview
  rather than silently redirect to a different section of the legacy hub.
- [ ] Test Facebook, Instagram, WhatsApp, email and club-website previews,
  plain-text copy, WhatsApp share and native device share (including cancelled
  share sheet). Never describe these as API delivery.
- [ ] Export square 1080×1080, portrait 1080×1350 and Story 1080×1920 PNG.
  Inspect full headline, long player names, sponsor/brand identity, clipping,
  punctuation, mobile and accents. Keep player consent in mind.
- [ ] Verify Cloud Draft API returns 503 while feature flag is OFF; no live
  social connections, automatic WhatsApp group posting, emails, token storage,
  scheduling or paid AI calls occur.
- [ ] Staging only: real RLS cloud-draft create/read/edit/delete and token
  workflow must be tested after security prerequisites, never against GSM
  production.

## Session 5: Rallora Guide, accessibility and regression

- [ ] Guide opens/closes and routes to current club. It must not claim to
  know live fixtures or be a generative AI assistant.
- [ ] Guide remains hidden on the legacy GSM route and cannot show private
  club information or make paid calls.
- [ ] Keyboard and screen reader navigation, focus indicators, readable error
  states, heading order, mobile keyboard occlusion, iPhone safe area.
- [ ] Browser back/forward, 404 club, expired session, poor connectivity,
  interrupted downloads and permissions denial.
- [ ] No console errors, raw exception traces or personal IDs exposed.

## Record each issue during testing

`ID | Severity | URL / club / role | Device / browser | Git SHA |
Steps to reproduce | Expected | Actual | Screenshot or screen recording |
Owner | Fix commit | Retest result`

Severity: P0 = interclub data exposure, data loss or production change;
P1 = unusable league, incorrect confirmed result or unauthorised posting;
P2 = broken export, layout or noncritical workflow; P3 = cosmetic.
P0/P1 block sign-off and require retest before launch. Do not label blocked
tests as passed.

## Day-end sign-off

Capture issues found, issues fixed and retested, explicitly blocked external
API work and any features deferred to the next release. Only the owner can
approve a production rollout and any new paid services, feature flags or
migration. Save screenshots and a known-good SHA; keep GSM rollback untouched.

**Proposed next sprint after read-only UAT:** complete offsite restorable backup,
isolated Supabase staging, real club RLS, club-write workflows, cloud draft UI
integration and an independently approved Meta test-account connection.
