# Consistent Rallora branding on pages and shared links

Shared Open Graph and Twitter previews use `rallora-social-master-v3.png`, composed from the approved `rallora-logo-dark.svg` without redrawing the logo. The editable SVG composition is checked in beside the PNG. The previous social-image URL also serves the updated artwork for existing integrations. The default metadata origin is the production Rallora domain.

The automatic Next.js favicon and SVG icon, legacy root home-screen PNGs, and legacy SVG mark URLs now use the current R and ball artwork. Explicit icon metadata includes a new version query to refresh browser caches. The PWA manifest already uses the approved navy PNG icons. Existing installed apps and messaging previews may retain cached images until their client refreshes them.

The league discovery page uses the shared master-logo component. Social Studio exports now load the existing master wordmark rather than a missing horizontal-logo file, preserving its aspect ratio. Club and sponsor logos remain controlled by their respective clubs.

Verification: visually inspected the 1200×630 preview, audited image references and legacy asset paths, and ran lint, unit tests, typecheck and a production build. No database or league data changes.
