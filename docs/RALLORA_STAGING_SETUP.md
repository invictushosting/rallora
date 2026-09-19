# Isolated staging setup for Rallora

**Required before enabling tenant writes or merging PR #1.** Rallora production: `vfebhddnjhylicapckro` (London). Unrelated Nebula Pay database: `vswyvcrtjvfxppiampsi`; do not touch.

## 1. Supabase staging project
- Ask the owner to approve any cost before creating a new Supabase project or branch. Never silently create a chargeable resource.
- Create a NEW project named `rallora-staging`, preferably in London eu-west-2. Record its NEW ref. The new ref must differ from BOTH existing production project refs.
- Keep Auth keys, service role secrets and database passwords in the staging secret manager, not GitHub, chat or commit history. Do not use actual participant passwords or live Auth session tokens.
- Keep the production emergency snapshot private and encrypted. Do not publish it to the public repository or seed PII into a demo/staging environment that doesn't need it.

## 2. Schema and sample data
- Take the missing full restorable backup before modifying production. Supabase default SQL dump may omit Auth/Storage schemas and definitely does not back up Storage file bytes. Never treat a partial JSON export as a full PostgreSQL restore.
- Reconcile the two already-applied `supabase/migrations` files against production migration history before using automated `db push`. Legacy `supabase/*.sql` are historical and MUST NOT all be applied sequentially.
- Restore sanitized schema and data into the NEW staging DB, including essential internal foreign keys and RLS. Create fresh staging-only Auth users for platform operator, GSM owner, demo owner, unauthorised user and suspended user.
- Check staging baseline: two clubs, their own seasons, divisions, teams, fixtures, scores and standings. Do NOT require the same identities, captain emails or exact production counts for privacy-safe testing.
- Stage `scripts/staging/001_club_scope_helpers.sql` only on the new project and verify it with the different-role cases. Helpers alone do not enforce club-level writes; existing broad legacy policies must be replaced by tested club-scoped policy migration before any new edit UI.

## 3. Preview environment
- Current connected Vercel API access can see `v0-nebula-pay-app` but not the `rallora-h8fx` project even though GitHub reports Rallora preview deployments. Recover authorised Rallora Vercel project management access before changing environment variables.
- Set Rallora Vercel **Preview** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the NEW STAGING project, not the production project. Keep Rallora Production variables untouched.
- If there are other Supabase URLs/keys, server-side service credentials or auth callback URLs, isolate those as well. Confirm each Vercel Preview deployment resolves to the staging ref in the browser network request.
- Verify Google/other auth callback allow-lists per environment, and run manual login tests with staging-only users.
- Never regard Preview as safe simply because its URL differs from production. Do not open the existing legacy GSM admin's write actions on a Preview pointing to live Supabase.

## 4. Permission and regression gates
Read `docs/RALLORA_AUTHORIZATION_AUDIT.md` and `docs/RALLORA_MULTI_CLUB_PHASE2.md`. Verify cross-club inserts AND updates, `USING` and `WITH CHECK`, attempted foreign-key reassignment, all legacy SECURITY DEFINER demo/reset/standings functions, captains' result submission permissions and suspended-member denial. Only after these checks pass should the new admin edit UI be enabled.

## 5. Release / rollback
- Confirm CI green on the exact proposed commit, complete a full offsite backup with Auth and Storage bytes, rehearse restore and record a rollback SQL/migration.
- Stage and test Rallora alone. Production `main` continues to operate the GSM hub until user acceptance.
- Promote gradually, beginning with GSM under platform supervision before accepting another paying club.
