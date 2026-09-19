# Rallora club isolation audit (read-only inspection, 2026-09-19)

**Status:** Evidence-based preparation, not a completed penetration test or a production change.
**Rallora project:** `vfebhddnjhylicapckro`. Never apply this to separate Nebula Pay project.
**Release block:** No second paying club, member write access, or new self-service signup until the items below have been implemented and verified on isolated staging.

## Verified database state
The current production schema has 21 `public` tables. Its existing `rallora_platform_admins` and `rallora_club_memberships` tables are read-only to authenticated users under RLS. There is one seeded platform admin row and one seeded GSM owner membership. No separate demo-club member was provisioned. Auth has two users.

The legacy `is_admin()` function is `SECURITY DEFINER` and checks the email in the authenticated user's JWT against `admin_users.email`. The old admin `ALL` RLS policies call `is_admin()` without checking which club a record belongs to. Current public read policies permit browsing all seasons, divisions, fixtures, results, standings, teams and cup data, which can be appropriate for published public competition content. Those are not club write entitlements.

### Existing broadly scoped write policies
`is_admin()` grants global legacy admin management on `clubs`, `seasons`, `divisions`, `teams`, `fixtures`, `results`, `standings`, `sponsors`, `announcements`, `club_rules`, `club_setup_profiles`, `cup_qualifier_rules`, `cup_manual_qualifiers`, `captain_users`, `team_captains` and `result_submissions`. An authenticated club organiser newly granted access via a comparable broad policy could reach another club's records. Do not copy these policies for tenant administration.

### Verified legacy RPC concerns
- `load_demo_club_data()` (authenticated EXECUTE, guarded by legacy `is_admin()`) picks the **newest active season globally** instead of a validated `club_id`. It invokes `reset_demo_data()` during operation. Its name must never imply it operates on the club selected in the UI.
- `reset_demo_data()` (authenticated EXECUTE, guarded by legacy `is_admin()`) likewise selects the **newest active season globally** before deleting results, fixtures, standings, captains, teams and demo sponsors. The UI promise “active club/season” was inaccurate.
- Both legacy actions are disabled in the `develop` UI, but **their production RPCs remain callable by existing legacy admins**. Removing a button is not database protection.
- `load_onboarding_demo_data(p_club_id,p_season_id,...)` checks that its season belongs to the supplied club. However, its scoring-rule selection includes `OR cr.season_id IS NULL` even for other clubs; sorting by most recently updated can select the wrong club's default rules. This RPC also deletes and replaces data for the chosen season, so retain only for tightly authorised staging/demo paths.
- `recalculate_standings_for_season(p_season_id)` uses `cr.season_id IS NULL` without requiring the matching club, so a different club's newer default rule can be chosen. Its missing-club fallback chooses the oldest active club, not an explicit tenant.
- `ensure_rules_for_season(p_season_id)` is `SECURITY DEFINER` and can write rules, but currently neither anon nor authenticated role has EXECUTE permission. Keep it non-public and avoid granting it until it validates the season/club and the caller.
- `captain_users` and `team_captains` authenticate by email; captain-related `result_submissions` policies and `SECURITY DEFINER` helper functions must be regression-tested before changing the email/user ID mapping. They are not interchangeable with club memberships.

## Required policy model
- **Platform operator:** Auth `user_id` appears in `rallora_platform_admins`. Can administer tenant billing, provision clubs and perform platform oversight, subject to explicit privileged actions.
- **Club owner/admin/organiser:** active membership matching `auth.uid()` and the target `club_id`; only manage that club's rows. Inviting/changing owners needs a stricter owner/platform rule, not general edit rights.
- **Captain:** verified own team/fixture privileges; no club-wide management and no authority over other teams' score submissions.
- **Anonymous visitor:** public/published league reads only. Keep personal contact data on protected views or private tables; don't rely on the club URL hiding anything.
- **Service role:** backend jobs only; never embed the service-role key in a client bundle. Any `SECURITY DEFINER` RPC must check target IDs and caller privileges independently of its UI.

## Ownership joins for database RLS
| Table | Owning club path |
| --- | --- |
| clubs | clubs.id |
| seasons, sponsors, announcements, club_rules, club_setup_profiles | direct club_id (also verify optional season_id matches the same club) |
| divisions, standings, fixtures, cup_qualifier_rules, cup_manual_qualifiers | season_id -> seasons.club_id; for fixtures/standings/cup also check division belongs to same season |
| teams, captain_users, team_captains, team_players | team -> division -> season -> club |
| results, result_submissions | fixture -> season -> club |
| players | no club_id or membership relation currently; MUST NOT expose to general club admin without a separate ownership model |
| admin_users | global legacy identity; not a tenant resource, keep platform-only and migrate away from email authority |

## Staging validation must cover
1. Seed two unrelated test clubs and two different verified user IDs; club A member can mutate A rows but NOT B rows.
2. Attempt to UPDATE a row from A by changing its foreign key to a B season/division/team/fixture. RLS `USING` and `WITH CHECK` must both reject.
3. Attempt to insert fixture A season with B division or B team IDs; database constraint/trigger or validated RPC must reject even if RLS alone permits that row.
4. Attempt to insert/update results pointing at fixtures in B; reject.
5. Attempt to submit as another team or change `result_submissions.submitting_team_id` during UPDATE; reject.
6. Test unauthenticated, authenticated nonmember, suspended member, owner, admin, organiser, platform operator, and captain roles independently.
7. Test all `SECURITY DEFINER` RPCs on wrong club/season IDs. Demo/reset operations should accept explicit IDs and refuse production or be withdrawn.
8. Verify existing GSM data and legacy `/` workflows in staging before any production migration.

**Next implementation order:** isolate staging and complete restorable backups -> write validated SQL functions and membership RLS in staging -> audit relational ownership constraints and RPCs -> enable club-specific UI edits -> invitation flow -> production rollout with rollback.

## Supabase Security Advisor read-only inspection (2026-09-19)
The connected project's Security Advisor reports **two informational RLS-without-policy findings** (`players`, `team_players`; these are currently inaccessible via the normal client, not automatically unsafe), **four functions with mutable search_path**, **nine exposed authenticated SECURITY DEFINER functions**, and **leaked-password protection disabled**. Do not bulk-grant read policies to quiet lints or revoke every helper without checking RLS dependencies. Remediate first on staging, then apply a reviewed migration to production after backup.
- Supabase RLS guidance: https://supabase.com/docs/guides/database/postgres/row-level-security
- Function path lint: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
- Exposed definer lint: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Auth password security: https://supabase.com/docs/guides/auth/password-security

## Disposable CI permission test (synthetic, not end-to-end staging)
`scripts/staging/ci_fixture.sql` creates two fake clubs, separate user IDs/roles and two seasons/teams/fixtures in GitHub Actions' throwaway PostgreSQL service. It installs `scripts/staging/001_club_scope_helpers.sql`, applies a representative membership-scoped `teams` RLS policy and runs assertions for both owners, an unrelated user, a suspended member, a captain, no Auth user, the platform operator, denied cross-club UPDATE/INSERT and attempted reparenting. The fixture deliberately includes **no production PII or secrets**. Passing it proves these synthetic permission primitives, **not** that existing production policies, all other tables, Supabase Auth/JWT integration or Vercel Preview are safe.
