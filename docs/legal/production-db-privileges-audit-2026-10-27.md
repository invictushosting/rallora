# Rallora production database privileges audit — 27 October 2026

Read-only inspection, no changes to production schema, tables, privileges, or player records.

## Verified CI
GitHub Actions run 40513216168 completed successfully. Four jobs: build, existing tenant-safety, privacy migrations, public-event-security. The last two run against disposable synthetic PostgreSQL; they are not full Supabase Auth browser end-to-end tests.

## Current production Supabase advisories
- 6 RLS-enabled tables with no policies: `public.players`, `public.team_players`, `public.rallora_fixture_reminder_log`, `public.rallora_integration_request_limits`, `public.rallora_integration_secrets`, `rallora_private.delivery_worker_config`.
- Direct privilege checks performed today show **no SELECT or INSERT privilege** on any of these six for either `anon` or `authenticated`. No blanket policy should be added; RLS + privilege restrictions appear intentional. This check does not prove full security of privileged service code.
- `pg_net` extension in public: warning remains, moving extensions requires compatibility / caller assessment.
- `rallora_club_feature_enabled`: anonymous SECURITY DEFINER executable (one warning). A tested mitigation is in draft migration `20261027141000_public_events_feature_routine_boundary.sql`, **not deployed**.
- 48 SECURITY DEFINER routines executable by authenticated role: many are intentionally used for scoped authorisation; automatic revocation would break league operations.

## Priority inspection: existing authenticated routines

| Function | Live findings | Next verification |
|---|---|---|
| `load_onboarding_demo_data` | SECURITY DEFINER, signed-in callable, explicitly calls `public.is_admin()`. That function delegates to `rallora_is_platform_admin()` backed by `auth.uid()` and platform-admin table. Critically destructive (clears season results, fixtures, teams) once authorised. | Confirm no ordinary signed-in user can invoke; protect demo-only activation workflows, test production safeguards. |
| `rallora_admin_reopen_fixture` | Reads target fixture then calls `rallora_can_manage_fixture` before deletion/update. | Cross-club negative tests and non-manager denial. |
| `rallora_admin_resolve_result` | Reads target fixture then calls `rallora_can_manage_fixture` before write. | Validate scores / authorization / conflicting requests and cross-club denial. |
| `rallora_can_manage_fixture` | Derived check validates fixture -> division -> season relationship and calls `rallora_can_manage_season`. | Verify membership and platform-admin behavior via synthetic identities. |

The presence or absence of a specific helper name within a function body is not sufficient to determine safety. Checks may be indirect; each routine requires contextual review.

## Next actions
1. Complete direct synthetic role tests for high-impact routines and build a negative-test matrix.
2. Audit integrations and service-role usage, including whether `pg_net` calls depend on its existing schema.
3. Confirm that live app routes use only the intended RPC interfaces, including captain/result workflows and admin settings.
4. Apply proposed security migration only after verified Supabase Auth/anon role tests and monitored production change window with rollback.
5. Do not conflate adviser count with confirmed vulnerabilities or declare full GDPR compliance.
