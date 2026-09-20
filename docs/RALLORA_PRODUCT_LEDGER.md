# Rallora: product development and release ledger

This document describes what is implemented, what is staged, and what is NOT yet safe
to advertise to new clubs. Update it as each acceptance gate is completed.

## Current topology

- ONE GitHub repository: `invictushosting/rallora`.
- Original GSM deployment: GitHub `main`, kept unchanged as rollback.
- New unified Vercel project: `rallora` at temporary `rallora-rho.vercel.app`;
  Production branch tracking `develop`. Do not connect a custom domain prematurely.
- Both front ends currently use the SAME production Rallora Supabase project
  `vfebhddnjhylicapckro`. Preview is NOT an isolated DB sandbox.
- DO NOT modify unrelated Nebula Pay Supabase `vswyvcrtjvfxppiampsi`.
- Supabase Free already has two active projects. The disposable Postgres CI job
  can exercise synthetic RLS but is not a replacement for full staging Auth/Storage.

## Shipped in develop: public club product

- Rallora landing page: real club and explicitly labelled demonstration club.
- GSM complete original league at `/clubs/gsm-padel`; original GSM bookmarks
  and `/admin` compatibility redirects; independent new GSM overview at
  `/clubs/gsm-padel/overview`.
- Shared `/clubs/[slug]` league centre for each other club: public active/completed
  seasons, divisions/standings, full filtered fixtures, confirmed results,
  teams, announced cup qualification and manual seeds, club news and sponsors.
  Fixtures respect `available_from` in the new public centre.
- Responsive mobile navigation, season selector, division selector, team search,
  fixture/result search and show-all pagination. No public captain emails fetched.
- Platform-operator and per-club membership-checked read-only dashboards.

## Product family and Social Studio (develop, not necessarily live on Vercel)

- Product-family landing routes: `/products`, `/leagues`, `/social`,
  and `/interclub`, linked from the Rallora home page.
- Rallora Interclub is explicitly labelled a future product. There is NO
  interclub invitation or shared event database yet.
- Rallora AI is documented as a future cross-product assistant, not an active
  AI chat service. No API account, key, usage costs or model calls are enabled.
- Rallora Social first-release studio at `/clubs/[slug]/social`, accessible
  via membership-checked club administration. It verifies Supabase Auth user
  and club owner/admin/organiser or platform admin before showing data.
- Social Studio allows club news, confirmed-result cards and latest-week roundups
  from two latest published seasons of that club; editable text and selected
  Facebook, Instagram, WhatsApp, email and club-site manual previews.
  Users can copy channel captions, open the normal WhatsApp share composer,
  and download a square club-branded graphic featuring official Rallora artwork.
- Social Studio now automatically saves a **device-only local draft** scoped to
  the verified Auth user and club ID, with an explicit clear control. It is NOT
  synced between devices, securely backed up or visible to other organisers.
  It also exports square (1080×1080), portrait (1080×1350) and Story (1080×1920)
  branded graphics. Generated drafts do not auto-update if results are corrected.
- The **cloud-draft API** (`app/api/social/posts/route.ts`) is written but OFF
  by default (`RALLORA_SOCIAL_DB_ENABLED=false`). It uses only the verified
  user session, club membership checks and RLS-scoped anon access; it has
  no service-role key. Do not enable it on the live shared database.
- The proposed Social schema in `scripts/staging/003_social_schema.sql`
  includes club-scoped posts, post targets, safe connection metadata and
  backend-only delivery jobs. It has NOT been deployed to production or a
  real isolated Supabase staging project. Disposable synthetic CI tests
  `ci_social_assertions.sql` exercise draft-only writes, blocked client
  scheduling/publishing, suspended members and cross-club leakage.
- Social Studio DOES NOT connect social accounts, publish to the club website,
  send WhatsApp Business messages, schedule posts or email players. No
  WhatsApp group/Status API claim. No real delivery worker or provider
  tokens are active. The staging schema is not a shipped cloud service.
- The floating Rallora Guide is **rule-based navigation**, not a connected
  generative AI chatbot. It does not receive private records, make model API
  requests, persist chats, or answer live scores from unseen data. It is hidden
  on the original GSM legacy route.
- Work remains gated by full backup/restore, isolated staging, complete tenant
  RLS, OAuth approvals, messaging consent and a reviewed delivery pipeline.
- GitHub CI validates build and synthetic tenant safety; passing CI does not
  resolve Vercel Hobby build-rate restrictions or justify merging develop into
  GSM main. Check Vercel status separately.

## Built but OFF by default: club-owner editing

`app/clubs/[slug]/admin/club-editor.tsx` implements club branding, draft season,
division, team and scheduled fixture forms. Each operation checks a verified Auth user,
owner/admin/organiser membership or platform admin, and scopes selected IDs to the
club. It is **NOT visible/enabled unless**
`NEXT_PUBLIC_RALLORA_ENABLE_CLUB_WRITES=true` is explicitly configured. Do not set
that variable on either production or Preview while security and recovery gates remain
open. A client-side guard does not replace DB RLS. Existing GSM full management UI
continues on the original deployment and is not a template for new club permissions.

`scripts/staging/001_club_scope_helpers.sql`: candidate verified-user club scope
helpers, already run only in disposable synthetic CI.
`scripts/staging/002_core_tenant_rls.sql`: candidate scoped/published RLS for the
six core tables (clubs, seasons, divisions, teams, fixtures, results); tested only
in synthetic CI with two fictional clubs including denied cross-club writes and
unpublished reads. **NOT deployed to production or real Supabase staging**.
Neither script is inside the migrations folder deliberately.

## Still needed before accepting independent customer clubs

1. Actual verified offsite PostgreSQL backup, Auth backup, Storage object bytes, and
   a successful throwaway restore. Emergency private JSON snapshot is partial.
2. A separate, isolated staging Supabase environment or a thoroughly documented
   local Supabase Auth/Storage staging equivalent. Configure Preview to point at it.
3. Complete RLS & SECURITY DEFINER RPC coverage for ALL league tables, including
   standings, cup rules, result submissions, team-captain identity, rules, sponsors,
   announcements and onboarding. Existing legacy `is_admin()` is still GLOBAL.
   Staged 002 is only the six-table core, NOT the finished migration.
4. Close privacy gaps: ordinary clients must not be able to read captain email
   addresses of unrelated clubs simply by selecting columns on published teams.
   RLS restricts rows, not columns. Define safe public data views / privileges and
   test authenticated and anon separately before enabling editing.
5. Integrate team/result/standings transactions and cup scoring rules without
   the current legacy RPCs selecting a globally newest season or foreign-club
   default rule. Database constraints must reject changing a team's division
   where it breaks existing fixtures/results.
6. Implement owner invitations, email verification, role changes and revocation
   backed by verified Auth user IDs. No unaudited public club-signup endpoint.
7. Club-owned assets, settings and contact forms with upload MIME/size checks;
   never expose Supabase service-role keys in browser environment variables.
8. Subscription/plans, trial/demo lifecycle, payment provider, refunds and
   invoicing once the owner confirms commercial model. Do not assume pricing.
9. Role-by-role, mobile and regression acceptance tests on isolated staging;
   verify GSM current season and legacy /admin/captain functions before rollout.
10. Explicit owner acceptance and documented production rollback; only then enable
    club writes and invite other clubs. GitHub build green is not UAT.

## Delivery order

Public multi-club product -> tested core tenant RLS -> remaining DB/RPC permissions ->
club-owner editing -> captain/result workflows -> club invitations and self-service ->
billing -> end-to-end acceptance -> domain cutover. Do not rush or silently skip the
restorable backup merely to show a working demo.
