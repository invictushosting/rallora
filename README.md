# GSM Padel League Hub

A mobile-first private league web app starter for GSM Padel.

## What is included

- GSM branded homepage
- League tables
- Fixtures
- Results
- Teams
- League Cup section
- Rules
- Admin dashboard mockup
- Supabase database schema starter

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Supabase setup

1. Create a Supabase project.
2. Open the SQL editor.
3. Paste and run `supabase/schema.sql`.
4. Copy `.env.example` to `.env.local`.
5. Add your Supabase URL and anon key.

The current UI uses local demo data. The next phase is wiring the pages into Supabase so admins can create seasons, teams, fixtures and results.

## Suggested MVP order

1. Public league hub using demo data.
2. Admin login.
3. Admin CRUD for teams/divisions/fixtures.
4. Captain login and score submission.
5. Opponent confirmation and admin disputes.
6. Automated tables and League Cup qualification.
