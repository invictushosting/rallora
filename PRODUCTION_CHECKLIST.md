# Rallora — Production Checklist

## Before deploying

- Confirm `.env.local` contains the Supabase Project URL only, not `/rest/v1`.
- Confirm only the anon/publishable key is used in the app.
- Never add the Supabase service_role key to `.env.local` or Vercel.
- Confirm the admin account is listed in `public.admin_users`.
- Confirm captain users are not admins unless intentionally added to `admin_users`.
- Run `npm run check` locally once before deploying.
- Confirm dependencies are pinned and `package-lock.json` is committed.
- Confirm club/social write flags remain `false` unless their security release
  has separately passed.

## Supabase checks

- Authentication users created for admin/captains.
- RLS enabled on admin-only tables.
- Sponsor upload bucket exists.
- Review only the new files in `supabase/migrations/`; do not bulk-run the
  historical SQL files under `supabase/`.
- Confirm the latest backup covers Postgres, Auth metadata and Storage bytes.
- Run Security and Performance Advisors after every DDL change.

## After Vercel deployment

- Add your live Vercel URL to Supabase Auth URL Configuration.
- Set the Site URL to the live app URL.
- Add redirect URLs for production and local development.
- Add Vercel environment variables.
- Test admin login.
- Test captain login.
- Test sponsor logo upload.
- Confirm legacy demo/reset RPCs are not callable by ordinary signed-in users.
- Test public site on mobile.
