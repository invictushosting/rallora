# Public client demo

Feature branch: `feature/client-demo`, based on `develop`.

`/demo` provides a no-login, fictional club tour with switchable player,
captain and organiser views. Player sections include a table derived from
four sample results, two remaining fixtures, and the results themselves.
Captain and organiser previews are explicitly read-only, not functioning
admin interfaces. Contact buttons open a mail composer; they send nothing.

The demo imports no Supabase client, authentication, production club data,
server actions, payment service or notification service. Role and section
choices live only in React state and reset on reload. No database seed or
schema changes are necessary. The existing site-wide guide is read-only.

## Release gates

- Do not merge directly into `develop`: repository notes say Vercel production
  tracks it, and the unified app shares GSM's production database.
- Confirm access to the Rallora Vercel project. The currently connected team
  lists only Nebula Pay. Do not deploy into that unrelated project.
- Review desktop/mobile and keyboard behavior on an authorised preview before
  merging. Check all three roles, all player sections and mailto destinations.
- Verify `/clubs/gsm-padel` and legacy bookmark redirects remain unchanged.
- A future editable sandbox must be isolated from production and must not
  enable real score writes, invitations, payments or notifications.
