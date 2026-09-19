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
