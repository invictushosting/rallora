# Zero-additional-cost compliance testing decision — 27 October 2026

**Decision:** Continue with existing GitHub Actions disposable PostgreSQL test databases and static/build checks. Do not touch Rallora production database. Do not create a billable resource or upgrade Supabase without separate cost approval.

## Staging feasibility checked
- Existing Supabase organisation is on Free and already has two active projects (Rallora and Nebula Pay).
- Supabase development branch creation failed: branching requires Pro or above.
- A separate Free project was quoted at USD $0/month but creation failed because organisation members had reached the active-free-project limit.
- No branch/project was created; no project paused or deleted, no plan changed.

## Added no-cost coverage
- Existing separate CI postgres services exercise rights-request RLS/admin functions, public events, tenant isolation, and schema migration syntax.
- `scripts/staging/ci_terms_acceptance_negative_cases.sql` tests absent acknowledgement, false acknowledgement, mismatched version, positive acknowledgement, DB timestamp and absence of event on later metadata updates.
- CI run for this change is tracked in draft PR #245. Passing fixture tests do not prove actual Supabase Auth email confirmation.

## Release constraints
Real Supabase sign-up confirmation, email deliverability, Data API behavior, OAuth redirect handling and full deployed browser behavior remain unverified without a safe Auth environment. Do not use production players as test accounts for unapproved draft legal documents. No GDPR production release until these gaps, legal approval and operational privacy-request monitoring are resolved.
