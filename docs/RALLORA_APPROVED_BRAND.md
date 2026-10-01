# Rallora Gold Master | implementation source of truth

**Authoritative source:** `Rallora_Gold_Master_FINAL`, approved 1 October 2026.

This Gold Master supersedes all earlier preview-derived, auto-traced, temporary, or legacy Rallora artwork. The Rallora logo is supplied artwork: never redraw the R, typeset the wordmark, trace a preview, or substitute an older export.

## Core identity
- Deep navy: `#061A39`
- Electric cyan: `#00B0FE`
- White: `#FFFFFF`
- Cool mist: `#E8F2F9`
- Product UI typography: Inter; Lato fallback
- Preserve the supplied artwork proportions and clear space.
- No gradients, outlines, stretching or effects on the master identity.

## Production web assets
The verified Gold Master web lockups are:
- `public/brand/rallora-logo-light.svg` — navy/cyan artwork for light surfaces.
- `public/brand/rallora-logo-dark.svg` — white/cyan artwork for dark/navy surfaces.
- `public/brand/rallora-brandmark-light.svg`
- `public/brand/rallora-brandmark-dark.svg`

`app/components/rallora-logo.tsx` is the standard product implementation and must continue to use these Gold Master SVGs.

## Email
Transactional email headers on navy must use the **dark-surface Gold Master lockup** (`rallora-logo-dark.svg` artwork), not the old `rallora-horizontal-light.png` export and never a typed RALLORA wordmark.

For broad email-client compatibility, a Gold Master PNG raster export should be used when available at the public email asset URL; SVG remains the verified artwork source.

## Legacy asset policy
Earlier preview-derived/auto-traced assets are deprecated. Do not introduce new references to them. Remove legacy duplicates only after confirming no live product, metadata, PWA or email reference depends on them.

## Gold Master rule
If an asset conflicts with the approved Gold Master package, the Gold Master wins.
