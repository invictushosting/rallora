# Rallora: environment and recovery gates

This branch is for rebuilding Rallora as a multi-club platform. The production application remains on `main`; do not merge this branch until release checks pass.

## Confirmed project mapping
| System | Rallora | Other product |
|---|---|---|
| GitHub | invictushosting/rallora | Separate repositories |
| Supabase | GSM_Padel_League_Web_App, ref vfebhddnjhylicapckro, London | Nebula Pay, ref vswyvcrtjvfxppiampsi, Ireland |
| Vercel | rallora-h8fx, project prj_IiCMLaZ0iA9GxIzNRPmXfYfhRD1V | v0-nebula-pay-app |

Both Supabase projects belong to the current Nebula Pay *organisation* but have separate databases. Do not run Rallora migrations on Nebula Pay.

## History
Two files under `supabase/migrations` mirror changes **already applied** to Rallora production on 2026-09-19. They are history, NOT unexecuted production instructions. Legacy `supabase/*.sql` files predate migration tracking. Baseline the existing schema before introducing automatic migrations; never apply all old scripts in sequence.

## Blocking full release
1. Store a **restorable offsite backup** of Rallora production. Supabase Free does not guarantee downloadable scheduled backups. Export role/schema/data with a Postgres/Supabase CLI connection from a trusted computer. Include Auth data and Storage object bytes separately, and test a restore. The standard `supabase db dump` excludes Supabase-managed schemas such as Auth and Storage (see current CLI docs). SQL exports may include personal information: keep private/encrypted and never commit them.
2. Preview and production currently use the same Supabase variables. Configure an isolated local/staging database and preview variables before doing destructive tests or enabling write-heavy club dashboards. A Vercel Preview URL is not a database sandbox.
3. Verify that the connected Vercel team can inspect the Rallora project. It has sometimes returned only Nebula Pay via API despite Rallora existing in the browser.
4. Run `npm ci`, `npx tsc --noEmit`, `npm run build`, platform/admin/captain login tests, and anonymous read checks before merging to main.
5. Verify and tighten remaining legacy global admin and captain RLS before opening self-service club signup.

## Intended tenancy
Rallora platform admins are identified in `rallora_platform_admins`. Club users are linked by verified Auth user ID in `rallora_club_memberships`; the roles are owner, admin and organiser. These tables are an **additive foundation only**. Legacy write policies still use the global `is_admin()` function. Club views must scope season, divisions, fixtures, results and mutations to the club slug and verified membership. A UI-only club selector is not sufficient authorization.

## Current recovered baseline
2 clubs, 3 seasons, 89 teams, 132 fixtures, 65 results; preserve GSM and demo club distinctly.

## Emergency application-data snapshot (2026-09-19)
A PRIVATE, owner-only Google Drive document named **Rallora emergency application-data snapshot 2026-09-19 (not full restore)** was created in the folder **Rallora Private Recovery Snapshots**. It contains JSON exports of all 21 existing `public` tables (548 rows, all 21 table counts verified against production after export), public column/constraint/index/RLS policy/function definitions, both Auth user/identity reference IDs, and Storage bucket/object metadata. This is an offsite emergency recovery record, **NOT a tested or complete PostgreSQL restore**. It deliberately excludes Auth passwords/tokens/managed schema and the binary Storage object bytes. Do not copy this document or its contents to this public repository.

Five Storage objects are currently recorded in the public `sponsor-logos` bucket; `club-logos` currently has none. Run `scripts/backup-rallora-storage.ps1` from a trusted Windows computer to download the current five public assets into a timestamped Documents folder with SHA-256 checksums and length validation. Verify the script against current Storage metadata if files have been added/replaced. SQL/roles export and Auth/Storage restore rehearsal remain outstanding. Keep production writes frozen for migration/release purposes, but safe work on the `develop` branch can continue.
