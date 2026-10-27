# Database security review — 27 October 2026

**Read-only assessment; no production grants modified.**

## Finding: `public.rallora_club_feature_enabled(uuid,text)`
- Live Supabase: `SECURITY DEFINER` with empty search_path; executable by both `anon` and `authenticated`.
- Function checks platform admin status or the requested club feature's active entitlement and subscription status; it does not directly return player records.
- `public.rallora_is_platform_admin()` validates `auth.uid()` against `rallora_platform_admins`.
- **Important dependency**: live `pg_policies` shows `rallora_club_events.published_events_public_read` calls this function as part of the anonymous, published-event read rule. Manager read/write policies also call it.
- Consequently, revoking anonymous function execute or changing to `SECURITY INVOKER` without a role-aware policy redesign can break published club-event visibility. Do not apply generic revoke instructions.
- Risk still exists: feature entitlement status for arbitrary club IDs and keys may be interrogated by anonymous API consumers, subject to values they guess. Determine intended visibility and whether a narrow public accessor is acceptable.

## Remediation design (not yet applied)
1. Inventory all direct RPC callers and RLS policy dependencies; verify actual API response behaviour using synthetic accounts.
2. Prefer a dedicated restricted public-events predicate that returns a minimal boolean only for publicly published club events, with tight `search_path`, minimal grants and tests.
3. Restrict administrative entitlement checks to verified club or platform admins; separate public and private functions.
4. Add regression assertions that anonymous published events remain readable, while draft/unpublished events, other clubs' data and private subscription details remain inaccessible.
5. Re-run Supabase advisors; review elevated authenticated functions one by one and only tighten those lacking appropriate identity/club checks.
6. Independently review `pg_net` in `public` and all RLS-enabled/no-policy tables, without moving extensions or altering policies during a live competition.

## Governance
Do not mark Supabase advisories resolved or Rallora UK GDPR compliant until changed behaviour is tested against both PostgreSQL/Supabase Auth identities and public event routes.
