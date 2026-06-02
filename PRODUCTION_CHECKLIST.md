# GSM Padel League Hub — Production Checklist

## Before deploying

- Confirm `.env.local` contains the Supabase Project URL only, not `/rest/v1`.
- Confirm only the anon/publishable key is used in the app.
- Never add the Supabase service_role key to `.env.local` or Vercel.
- Confirm the admin account is listed in `public.admin_users`.
- Confirm captain users are not admins unless intentionally added to `admin_users`.
- Run `npm run build` locally once before deploying.

## Supabase checks

- Authentication users created for admin/captains.
- RLS enabled on admin-only tables.
- Sponsor upload bucket exists.
- Run `supabase/production-safety-check.sql` once before deployment.

## After Vercel deployment

- Add your live Vercel URL to Supabase Auth URL Configuration.
- Set the Site URL to the live app URL.
- Add redirect URLs for production and local development.
- Add Vercel environment variables.
- Test admin login.
- Test captain login.
- Test sponsor logo upload.
- Test demo data manager.
- Test public site on mobile.
