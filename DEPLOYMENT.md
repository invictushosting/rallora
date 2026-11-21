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

## League entry fees and WhatsApp reminders

Apply the entry fee and WhatsApp migrations before deploying the application build. Both features are off by default at club level. A competition starts collecting only when its club saves an enabled fee.

For WhatsApp, connect a Rallora-owned WhatsApp Business sender in Twilio and request Utility approval for the reminder template. Configure its template variables in this order.

| Variable | Value |
| --- | --- |
| 1 | Club name |
| 2 | Reminder title |
| 3 | Fixture and timing details |
| 4 | Rallora match centre link |

Example template body:

```
Rallora fixture reminder from {{1}}.
{{2}}
Fixture details: {{3}}
Open your match centre: {{4}}
Reply STOP to turn off Rallora WhatsApp reminders.
```

Set the five WhatsApp environment variables listed in `.env.example` for the environment and set the Twilio inbound webhook to POST to the exact HTTPS URL in `TWILIO_WHATSAPP_INBOUND_URL`. This is normally `https://www.rallora.app/api/integrations/whatsapp`. The webhook uses the server-only Supabase service role key and validates Twilio’s signature. Use the primary Twilio auth token. If using a Twilio Messaging Service, forward inbound messages and opt-out events to this endpoint.

With a test club and opted-in test number, verify that JOIN connects the number, a due fixture reminder reaches it, and STOP or Account opt-out suppresses a queued reminder. Check acceptance in Notifications & reminders and actual delivery in Twilio. Confirm the opt-in wording and privacy information before toggling WhatsApp on at a pilot club.

## Stripe Connect sandbox

Configure this on a local or protected preview build with an isolated Supabase project or branch. Apply the entry fee and Stripe migrations there. Set the Stripe sandbox variables in `.env.example`, the matching public Supabase URL and anon key, and the server-only service role key. Set `RALLORA_STRIPE_SANDBOX_ORIGIN` to the exact preview origin without a trailing slash.

Use the Stripe Connect test client ID and OAuth redirect `/api/integrations/stripe/callback` on that origin. In Stripe, register a webhook for **events on connected accounts** at `/api/integrations/stripe/webhook`. Set the sandbox webhook signing secret from that endpoint. Subscribe to `checkout.session.completed`, `charge.refunded`, `refund.updated`, `account.updated`, and `account.application.deauthorized`.

In club admin, open **League entry fees**, connect the club’s test Stripe account, and select **Stripe Connect** for a test competition. Submit a pair as a player, cancel and reopen the checkout, complete a test card payment, check the status in Account and Registrations, and approve the paid entry. Use the club’s Stripe dashboard to test partial and full refunds. Refresh Registrations and Account to check both refund statuses. Run a second club sign-in to check that access stays within each club.

Card checkout is test-only in this build. Keep prize-funded competitions out of the sandbox rollout pending provider eligibility review for the intended live model.
