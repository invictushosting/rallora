# Rallora — Production Deployment Guide

## 1. Prepare the repository

```bash
git checkout main
git pull --ff-only
npm ci
```

## 2. Verify database changes

Only files in `supabase/migrations/` form the deployable migration chain. Review
new migrations, test them against disposable PostgreSQL, and confirm rollback
and backup coverage before changing production. Do not run every historical SQL
file directly under `supabase/`.

## 3. Test production build locally

```bash
npm run check
```

If it completes successfully, the project is ready to deploy.

## 4. Deploy through GitHub

Open a pull request into `main`. Merge only after both GitHub quality-gate jobs
pass. The canonical Rallora Vercel project should deploy `main` automatically.

## 6. Add Vercel environment variables

In Vercel:

```text
Project → Settings → Environment Variables
```

Add:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
NEXT_PUBLIC_SITE_URL=https://your-vercel-project.vercel.app
NEXT_PUBLIC_CLUB_SLUG=gsm-padel
NEXT_PUBLIC_RALLORA_ENABLE_CLUB_WRITES=false
RALLORA_SOCIAL_DB_ENABLED=false
```

Then redeploy.

## 7. Update Supabase Auth URLs

In Supabase:

```text
Authentication → URL Configuration
```

Set Site URL to your live URL:

```text
https://your-vercel-project.vercel.app
```

Add redirect URLs:

```text
https://your-vercel-project.vercel.app/**
http://localhost:3000/**
```

## 8. Final test

- Public homepage loads.
- Tables load live data.
- Admin login works.
- Captain login works.
- Sponsor upload works.
- Disabled demo/reset actions remain unavailable.
- Club and social writes remain disabled unless their authorization release has
  separately passed.
- Mobile view looks clean.
