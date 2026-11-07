# Production security evidence — 7 November 2026

Read-only metadata/adviser inspection of Rallora (`vfebhddnjhylicapckro`, London / eu-west-2). No player records, credentials, settings, grants or production migrations were changed. This is a scoped checkpoint, not a penetration test or legal certification.

| Check | Observed evidence | Interpretation / action |
|---|---|---|
| Public base-table RLS | 61/61 enabled | Enabled is necessary, not proof every policy is correct; CI negative-role tests remain required |
| Tables with no RLS policies | Six: legacy players/team_players, reminder log, integration secrets, integration request limits, private worker config | All six deny SELECT to both anon and authenticated. Do not add permissive policies to clear an informational warning |
| SECURITY DEFINER search paths | No public/private definer routine lacks an explicit search_path setting | Does not independently prove every configured path or authorization check safe |
| Shared private schema | anon and authenticated have USAGE | Required for existing invoker/RLS/worker dependencies; restrict sensitive objects individually |
| Privacy objects | No matching privacy requests, acceptance ledger or notification outbox relations; no privacy/terms routines; no non-internal auth.users triggers | Compliance changes remain undeployed |
| Migration ledger | 88 entries, latest `20261106082618_all_player_match_actions` | Source timestamp differs; preserve existing mapping rather than replaying applied migrations |
| Support screenshots | Private bucket, restricted image MIME types, 5 MB bucket ceiling | UI/API impose tighter upload constraints; no object contents read |
| Brand media | Club/sponsor logo and club-media buckets public | Appropriate for intended published brand assets; never upload support/identity material here |
| Password leak protection | Adviser reports disabled | Open: verify available Auth plan/configuration and enable/test through supported Auth management; not silently changed |
| pg_net in public | Existing warning | Existing scheduled worker depends on net.http_post; not moved in this release |
| Anonymous feature function | `rallora_club_feature_enabled` callable; returns entitlement boolean with empty search_path | Draft event-boundary migration and dedicated negative-role tests address the public-event dependency. Do not revoke blindly |
| Authenticated definer routines | Adviser reports 46 callable routines | Requires documented per-routine authorization assessment; warning count alone is not a vulnerability finding or clearance |

Security adviser categories: one INFO category (six instances) and four WARN categories (pg_net, anonymous definer, authenticated definers, password protection). No fresh runtime-log, MFA, backup, recovery or managed-Auth test is claimed.

## Regression fixed in this draft
The uninstalled acceptance migration formerly revoked ALL shared-schema privileges from anon/authenticated. That would remove production USAGE required by match chat and the token-authenticated delivery worker, repeating the November regression. It now revokes CREATE only, preserves USAGE and explicitly denies browser access to the new ledger and trigger function. A disposable PostgreSQL fixture models pre-existing invoker callers; post-migration assertions verify both callers still work while private acceptance data stays inaccessible.

## Independent release evidence still needed
Per-routine negative-role coverage/assessment, privileged MFA and account recovery evidence, managed Auth/signup/mail tests, supplier settings, restorable backup (including Auth/storage scope), actual restore rehearsal and signed-in browser checks. No blanket grants, revokes, table-policy additions or destructive cleanup are justified by this checkpoint.

Adviser references:
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
