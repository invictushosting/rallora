# Rallora Social — current product and delivery record

Owner: Ste Mahon. Updated 21 November 2026. Scope: local branch only; no GitHub push or production release authorised.

## Product

Rallora Social is the club marketing product connected to Rallora Leagues. It turns verified club activity into branded content. It is not a playing-session booking product. Clubs choose a design and review artwork and captions before a manual handoff. Players have a simpler public confirmed-result sharing dialog without club editing, AI or publishing access.

The approved design collection has twelve distinct families: Centre court, Match poster, Club moment, Round in review, The round edit, The standings, Top of the box, Moving up, Entries open, Last call, On the calendar and In good company. Every family supports Square, Portrait and Story. The offline design gallery is separate from the application and uses fictional data.

## Implemented locally

### League studio

Seven designs use selected published-league data: three result designs, paginated roundup grids, paginated carousels, current standings and a division-leader spotlight. The connected renderer requires supplied source data; no demo records are used in these exports. Names and scores stay separate from editable prose.

All published seasons can be selected with paginated reads. Each source query has deterministic ordering, bounded IN clauses and explicit paging limits. Exceeding a limit produces an error instead of a partial post. The old two-season/400-fixture cap is confined to the legacy news workspace.

Result artwork uses historical fixture name snapshots where available. Current tables use current pairing names and the league hub's points, score-difference and name ordering. Tables do not predict promotion/relegation. Unreleased, cancelled and unconfirmed results are excluded; tables are blocked where confirmed fixture records are unreleased, incomplete or inconsistent. Longer result names may be abbreviated in compact grids; captions retain full names. All selected records continue onto additional artwork pages.

### Club campaigns

Five designs use verified club records:

- Entries open: registration published and currently open, including public registration in a draft league.
- Last call: the same open state plus a valid saved closing timestamp. Countdowns and exact UTC deadlines are rechecked at handoff; no date is invented.
- On the calendar: upcoming published events with valid dates. No time, price or booking availability is invented.
- In good company: active sponsors with a verified club, published league/division or published event target. Sponsor logos must load before graphic export.
- Moving up: recorded promoted/relegated rows in an active successor cycle, linked to its same-club published predecessor. Private successor drafts, missing links, inactive teams and changed pairings are excluded. The design does not infer movements from the current table.

Optional unavailable sources show category-specific notices. Source failures never substitute fictional data. Movement reads use the existing manager-scoped `rallora_admin_season_teams` RPC with explicit movement/roster columns, not contact fields.

### Branding, review and handoff

Club name, logo and colours come from the profile. The same self-contained SVG drives preview and PNG export. Photos are type/size checked, resized in the browser, session-only and never uploaded or autosaved. Sponsor logo state is bound to its selected source URL so a previous sponsor's image cannot slip into a new selection.

Every handoff rechecks the verified user, club-manager permission, active club branding and the complete current selected source. Source revisions catch corrected scores, added/removed results, roster/name changes, changed tables, publication changes and changed campaign facts. Changes rebuild facts/captions and clear review. Clock-only registration expiry/countdown changes are checked immediately before browser handoff. Async exports also check that the approved draft is still current before triggering download. Client review is not a server-side approval ledger.

The new league/campaign workspace stays in memory. Club news remains accessible in its original editor with its separate user/club browser draft and seven-day inactivity expiry. There are no shared cloud drafts. Caption channel formatting is manual and may shorten Instagram/WhatsApp content; the UI shows the prepared version. Already downloaded or externally posted files cannot be recalled after a correction.

## Evidence and outstanding acceptance

Automated checks cover source/publication/tenant boundaries, permission denial, pagination above the former caps, exact score orientation, historical/current roster choices, table ordering, no synthetic fields in connected outputs, eligibility/expiry, sponsor scope, actual movement linkage, unavailable sources, SVG escaping, pagination and export dimensions. The full application test suite passes 162 tests. TypeScript and the production build pass using synthetic public Supabase configuration. Lint has no errors and 17 existing warnings. Source-driven artwork has been rasterised and inspected across all three sizes.

Full browser acceptance is BLOCKED in this execution environment: Chromium cannot start because its process-singleton socket is denied (`Operation not permitted`). Do not count raster inspection or mocked source tests as browser acceptance. Before release, complete actual desktop/mobile interaction, real Supabase Auth/session/account-switching, permission revocation, clipboard, media upload, PNG download and changed-source walkthroughs. The test-day checklist is in `RALLORA_SOCIAL_BROWSER_ACCEPTANCE.md`.

No production database reads/writes, migration, model call, provider connection, external message or deployment was performed for this local implementation. The source loaders are wired for existing app records but live GSM acceptance is not claimed.

## Remaining product stages

1. **Shared workflow and saved brand kits.** Isolated staging, club/author/reviewer isolation, shared drafts, versioned template/asset references, approved revisions, edit history, export records and a content calendar. Define media scope/expiry and include media in backup/recovery. Current profile branding is not a stored multi-template brand kit.
2. **Grounded writing assistant.** Authenticated server-side generation, verified source facts, configurable club voice, versioned prompts, structured output and factual validation. Never fabricate scores, rankings or achievements. Exclude contact fields, fixture chat, exact booking details and credentials. Treat club text as untrusted input; return editable suggestions for human review. Require provider account setup and an approved cost/usage budget before real model calls.
3. **Connected publishing.** Official provider registration/permissions and club OAuth, encrypted token storage/revocation, scoped accounts, approved immutable revisions and an idempotent server delivery queue. Revalidate authority and facts when executing. Capture timezone, provider receipts, attempts and failure reasons. Queued is not delivered; account disconnect, suspension or revoked approval must stop delivery. Verify current provider requirements against official documentation at integration time.
4. **Pilot and commercial rollout.** Feature-gated club access; agree pilot inclusion and pricing separately from free Leagues use. Set per-club rate/concurrency/spend caps, retention, abuse controls, redacted monitoring, invoice reconciliation and support ownership before charging. No Socials price, provider allowance or unlimited generation promise has been approved.

AI generation, persistent shared approvals, scheduled delivery and connected social-account publishing are NOT implemented or enabled by the manual studio. WhatsApp group/Status auto-posting is not promised. Children/publicity and other compliance decisions remain in the separate compliance records; a review checkbox does not settle them.
