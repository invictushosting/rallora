# One Rallora, all clubs: unified app migration

## Architecture implemented on develop

The original GitHub repository `invictushosting/rallora`, Next.js application and existing Supabase project remain the **single Rallora product**. We have NOT created or committed a second application, upgraded Supabase, touched unrelated Nebula Pay, merged `develop` or deployed a production release.

| Route on develop | Purpose |
|---|---|
| `/` | New Rallora platform landing page listing active clubs from the same Supabase project. |
| `/clubs/[slug]` | Each club's new read-only, slug/ID/season scoped hub. |
| `/clubs/[slug]/admin` | New membership-checked read-only club control centre. |
| `/clubs/gsm-padel/legacy` | **Complete original GSM league UI**, preserved for existing functions while we gradually migrate each to tenant-safe routes. |
| `/platform` | Read-only platform-operator dashboard. |
| `/admin` | Compatibility redirect to `/clubs/gsm-padel/legacy#admin`. |
| `/rules`, `/admin/rules` | Existing GSM rules pages; their club and active-season lookups now require `gsm-padel` explicitly. |
| `/onboarding` | Existing operator onboarding workflow, NOT self-service; must remain gated until an isolated staging/backup release. |

On `develop`, legacy root hash links such as `/#captain` and `/#admin` redirect to the preserved GSM legacy route with the original hash. The legacy view also links back to Rallora's club directory and its new GSM overview. GSM remains the initial real tenant, not a second app/site.

## Important legacy defect corrected in develop

The old root queried the *newest active season across all clubs*. In production, the demo `new-padel-club` **Opening Season** was created later than GSM's **Summer 2026** and both are active, so this global query could select the demo from the GSM UI. On `develop`, the preserved GSM public, cup, captain and admin season lookups are explicitly restricted to GSM club ID. GSM's public sponsors, announcements, current fixtures/results, admin captain/submission lists and rule lookup have also been restricted to GSM-relevant records. The original global demo load/reset UI actions remain disabled on `develop`.

**This fixes app read paths and some admin write scopes, not every legacy permission.** DB `is_admin()` is still global; `recalculate_standings_for_season` can still select another club's default rule; captain email-based identity and onboarding demo RPC must be audited. Do not advertise this as full tenant isolation.

## Required acceptance before replacing the live root

1. Recover/verify the actual GSM production Vercel management account. The currently connected Vercel account returns only a Nebula Pay project; do not modify it to fix Rallora.
2. Restore-rehearsed, encrypted offsite backup of user tables, database structure, managed Auth and actual Storage object bytes. Current private JSON snapshot is partial.
3. Isolate the Rallora Preview database. On the Supabase Free plan two live slots are occupied by Rallora and Nebula Pay. Use no-cost synthetic CI while staging remains unresolved; do not assume the synthetic DB is complete Supabase Auth/Storage staging.
4. Verify both clubs display **their own** active seasons and fixture/result counts; GSM legacy full tools, captain sign-in and direct /admin and root-hash bookmarks work.
5. Test all original GSM management features after staged DB scope changes: club branding, seasons, divisions, teams, fixtures, results, captains, sponsors, cup, rules. Check no accidental cross-club mutations.
6. Verify anonymous, nonmember, suspended member, GSM organiser, demo organiser and platform admin. Only after all scoped RLS/RPC checks can club organisers receive editing tools and onboarding invitations.
7. Obtain owner acceptance of the platform front door and GSM migration, then merge/deploy with documented rollback (old `main` commit plus database restore/rollback). Keep the live GSM application untouched until then.

The goal is **one product / one deployment / one multi-tenant database** with a platform operator and per-club dashboards, not duplicate Rallora installations for each customer.
