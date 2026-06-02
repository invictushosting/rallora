# GSM Padel League Hub — Vercel Deployment Guide

## 1. Apply this update

```powershell
cd C:\Users\invic\Downloads\gsm-padel-league-hub-starter\gsm-padel-league-hub
Expand-Archive "$env:USERPROFILE\Downloads\gsm-padel-production-deployment-prep-update.zip" -DestinationPath . -Force
```

## 2. Run the production safety SQL

Open:

```powershell
notepad .\supabase\production-safety-check.sql
```

Copy everything into:

```text
Supabase → SQL Editor → New Query → Run
```

## 3. Test production build locally

```powershell
npm run build
```

If it completes successfully, the project is ready to deploy.

## 4. Push to GitHub

Create a new GitHub repo and upload/push the project folder.

## 5. Import into Vercel

In Vercel:

```text
Add New Project → Import GitHub repo → Deploy
```

Use the default Next.js settings.

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
- Demo Tools work.
- Mobile view looks clean.
