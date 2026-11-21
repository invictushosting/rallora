# Rallora account-email branding

The password-reset delivery test arrived successfully but used the hosted provider's plain default template. Application-origin Rallora and club emails already use branded shared layouts.

Prepared branded hosted templates for confirmation, account invitation, magic link, email change, password recovery, reauthentication and all seven security notifications. These reuse the exact existing Rallora logo, navy/cyan palette, typography, table-based layout and responsive spacing. Club email rendering and sender routing are unchanged.

The generated configuration contains only subject/body fields. Secure confirmation links and OTP placeholders are preserved. No login method, notification toggle, SMTP credential, redirect allow-list or authentication policy is changed.

Validation: 119 application tests passed; lint has zero errors and 17 pre-existing warnings; TypeScript check passed. Tests check all 13 templates, generated-file drift, correct secure-link/code variables, the narrow 26-field configuration and unchanged club branding.

Live status: not applied. The connected Supabase tools do not expose hosted Auth configuration. The browser dashboard required sign-in; the secure sign-in flow was declined and was stopped. The current hosted account emails therefore remain unchanged. Follow `supabase/templates/auth/README.md` after dashboard access is available, then repeat the agreed reset test.
