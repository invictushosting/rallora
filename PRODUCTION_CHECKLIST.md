# Rallora — Production Checklist

## Before deploying

- Confirm the deployment uses the canonical `invictushosting/rallora` repository and `main` production branch.
- Confirm `NEXT_PUBLIC_SUPABASE_URL` is the Supabase Project URL only, not `/rest/v1`.
- Confirm `NEXT_PUBLIC_SUPABASE_ANON_KEY` contains only the public anon/publishable key.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. It is required for the trusted Playtomic player-rating sync and must never use a `NEXT_PUBLIC_` prefix or be exposed to browser code.
- Keep `RALLORA_INTEGRATION_ENCRYPTION_KEY` server-only. Use a 32-byte base64 key and never commit its real value.
- Confirm `NEXT_PUBLIC_SITE_URL=https://www.rallora.app`.
- During the pilot phase keep `RALLORA_MAINTENANCE_MODE=true`.
- Keep `RALLORA_PILOT_CLUB_SLUGS` empty until a real pilot club is approved; add only explicit pilot slugs.
- Keep `RALLORA_SOCIAL_DB_ENABLED=false` and `NEXT_PUBLIC_RALLORA_ENABLE_CLUB_WRITES=false` unless their separate release gates have passed.
- Do not set social OAuth, WhatsApp, AI-provider or payment-provider credentials before those integrations are deliberately released.
- Run `npm run check` and require Vercel Preview plus Rallora quality gates to pass before merging.
- Confirm dependencies are pinned and `package-lock.json` is committed.

## Supabase checks

- Confirm the production Site URL is `https://www.rallora.app`.
- Confirm redirect URLs include `https://www.rallora.app/**` and `http://localhost:3000/**`.
- Confirm RLS remains enabled on tenant/admin tables and platform access is based on `rallora_platform_admins` / club memberships rather than legacy `admin_users` assumptions.
- Review only new files in `supabase/migrations/`; do not bulk-run historical SQL files.
- Every merged database migration must be applied explicitly to the live Supabase project and then verified.
- Confirm the latest backup covers Postgres, Auth metadata and Storage bytes.
- Run Security and Performance Advisors after DDL changes; review warnings before changing security configuration.

## Pilot launch checks

- Approve the club through Platform Control Centre and confirm the applicant receives an active owner membership.
- Add the approved club slug to `RALLORA_PILOT_CLUB_SLUGS`, redeploy production, and verify its hub plus nested admin/register/captain/social routes while the rest of the application remains behind maintenance mode.
- Complete the first-club process in `docs/FIRST_PILOT_CLUB_CHECKLIST.md`.
- Test club-owner sign-in and Club Admin access.
- Test a captain account and partner membership claim.
- Test one complete fixture → result submission → opponent confirmation → official result → standings flow.
- Test organiser result reopen/recovery once before live league play.
- Test sponsor/logo/cover-image handling on the intended pilot device.
- Verify the public club hub and team-registration experience on mobile.
- Run the pilot-readiness report and investigate any non-zero warning counts.

## Playtomic checks (eligible clubs only)

- Do not enable live rating sync until both server-only variables, `SUPABASE_SERVICE_ROLE_KEY` and `RALLORA_INTEGRATION_ENCRYPTION_KEY`, are configured in the production deployment environment.
- Store the club's approved Playtomic Club API credentials and Venue ID through Rallora's integration flow; never commit them.
- Verify a signed-in test player is matched by email and receives the expected PADEL `level_value`.
- Treat Playtomic as read-only from Rallora: do not promise rating or result write-back.

## After production deployment

- Confirm `rallora.app` redirects to `www.rallora.app` and the canonical domain serves the expected deployment.
- Confirm the Coming Soon page, `/pilot`, and `/register-club` behave as intended.
- Confirm only approved pilot club slugs bypass maintenance mode.
- Check production runtime errors after the deployment.
- Do not describe outbound email/WhatsApp reminders or automatic social publishing as live until their providers and delivery paths have been separately configured and verified.
