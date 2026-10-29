# Rallora account-email branding

All 13 hosted Auth email types use the approved platform layout generated from `lib/email-templates.ts`. Club-origin league mail continues using `renderClubEmail`, its saved club logo/colour/sender identity, and the Powered by Rallora footer.

Regenerate after changing the shared layout:

```sh
node --experimental-strip-types scripts/generate-auth-email-templates.mjs
node --experimental-strip-types --test tests/auth-email-templates.test.mjs
```

## Apply to the hosted Rallora project

Project: `vfebhddnjhylicapckro`.

These repository files do not automatically change hosted Auth settings. In Supabase Authentication → Emails → Templates, paste each HTML file into the matching template and use its subject from `hosted-config.json`. Save and reopen each template to verify persistence. Start with Reset password and Confirm signup.

The alternative Management API payload is `hosted-config.json`, for `PATCH /v1/projects/vfebhddnjhylicapckro/config/auth` using an authorised administrator's existing credentials. Back up the current subject/body fields first. The payload contains only 13 subjects and 13 HTML bodies. Do not place access tokens, SMTP passwords or service-role keys in source control, chat, command output or this file.

Keep all authentication methods, redirect allow-lists, link expiry, confirmation requirements, notification enabled/disabled settings and SMTP credentials unchanged. Security notification designs are supplied for all seven types, but do not enable notifications merely to apply branding.

The five link-based templates retain `{{ .ConfirmationURL }}` exactly, including the original recovery/confirmation destination. Reauthentication retains `{{ .Token }}`. Do not replace these with a fixed account URL, enable link tracking or open/consume a user's token during verification.

## Verify and roll back

After applying, send a password-reset test to the agreed account `hello@rallora.app` (forwarded to the user's main inbox) and confirm receipt/design with the user. Recheck a confirmation email with a disposable approved test account; do not create a second account for an existing player. Preview the remaining templates with synthetic values. Club-email previews must retain their existing branding.

If a template fails, restore that template's saved subject/body without changing authentication settings or toggles.

Official reference: https://supabase.com/docs/guides/auth/auth-email-templates
