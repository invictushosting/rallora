# Rallora

Rallora is a multi-club padel league management platform by Protego Solutions.
The current production release includes the public club experience, fixtures,
results, standings, rules, captain/admin access, league planning, exports and
feature-gated social/payment tooling.

## Local development

Requirements: Node.js 22 and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Use a non-production Supabase project or placeholder values for local builds.
Never commit service-role keys, database passwords, or real participant data.

## Quality gates

```bash
npm run check
```

The GitHub workflow also runs tenant-isolation assertions against a disposable
PostgreSQL 17 service. Those synthetic tests do not replace end-to-end Supabase
Auth and Storage testing.

## Deployment and database changes

- `main` is the production source branch.
- Database changes belong in `supabase/migrations/`; files directly under
  `supabase/` are historical/reference SQL and are not a sequential migration
  chain.
- Club writes and social database writes remain off by default. Do not enable
  them until the authorization and recovery gates are complete.
- Review [DEPLOYMENT.md](DEPLOYMENT.md),
  [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md), and
  [docs/RALLORA_AUTHORIZATION_AUDIT.md](docs/RALLORA_AUTHORIZATION_AUDIT.md)
  before a production release.
