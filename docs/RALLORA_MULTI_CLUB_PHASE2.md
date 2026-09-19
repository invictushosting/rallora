# Rallora: Phase 2 multi-club review checklist

All Phase 2 work lives on the `develop` branch and the open **draft** PR #1. Nothing in this document authorises a merge or deployment to the live GSM league.

## Read-only club routes built
- `/platform`: platform-admin-only overview of the registered clubs and their seasons, with links to club hubs and their administration pages.
- `/clubs/gsm-padel`: brandable public GSM overview, with an explicit season selector and read-only division standings / fixture summaries.
- `/clubs/new-padel-club`: the same public view, populated strictly from the demo club's season and divisions.
- `/clubs/gsm-padel/admin`: signed-in membership-checked club dashboard (GSM has a seeded owner membership).
- `/clubs/new-padel-club/admin`: platform admins can review; other users require their own active membership for this specific club.
- Club admin has a standalone existing-account email/password sign-in. No open self-signup, new admin invitation, team editing, result approval, or payment collection is enabled.

## Tenant boundaries exercised in the client
Resolve the club URL slug to its DB UUID. Resolve seasons only where `seasons.club_id = clubs.id`. Resolve divisions, fixtures and standings by the selected season ID. Resolve teams only via those division IDs. Resolve results only via those fixture IDs. Empty ID lists result in empty data rather than unfiltered queries. Club admin permission is checked with verified Supabase Auth user ID, matching `rallora_club_memberships.club_id` and `status = active`, or membership in `rallora_platform_admins`. No private captain-email fields are requested in the new public UI.

**Important**: These are read-path controls and a UI guard, NOT a substitute for RLS. The existing production global `is_admin()` policies still grant legacy administrators broad write permissions across clubs. Those write paths cannot be safely exposed to other club organisers yet.

## Required manual regression checks, only on an ISOLATED staging Supabase project
1. As anonymous visitor open both public club routes; GSM and demo must not mix teams, standings or fixtures. Invalid/inactive slug must not show other club data.
2. Change season selector between active and draft GSM seasons. Count divisions, standings and fixtures against each known season.
3. Sign in using GSM's existing admin account at the GSM admin route. Verify that an admin session sees GSM seasons but demo membership is not implied; platform admin oversight is separately explicit.
4. Sign in as an authenticated user with **no** admin/membership: both club admin URLs must deny access.
5. Sign in with a test active member of demo club only: GSM admin must deny access, demo club admin must show demo club data only. Then suspend the demo membership and verify access is denied after a fresh login.
6. On staging, submit result and edit fixtures through legacy routes and inspect Supabase RLS. Do not invite paying clubs until privilege checks are enforced at the database layer.
7. Recheck mobile layout, season selection, and club admin sign-in, and confirm the old GSM `/` route still works as before.

## Outstanding release gates
- Full restorable, encrypted offsite database backup including managed Auth and actual Storage bytes, with a restore rehearsal. A private emergency JSON snapshot currently exists, but is **partial**, not a complete database restore.
- Isolated staging project and Vercel Preview environment variables. A preview link is not a database sandbox while the project still targets the production Supabase ref.
- Complete server/database authorisation audit of `admin_users`, `captain_users`, `team_captains`, result RPCs and all table policies, including legacy `is_admin()` bypass.
- Standalone account invitation, email verification, member management, and club owner billing remain future work.
- Automated CI typecheck/build must pass on the final head commit; staging auth workflows require human browser testing.

## Data references
Rallora production ref `vfebhddnjhylicapckro`. Nebula Pay is a separate unrelated project and must not be modified.
