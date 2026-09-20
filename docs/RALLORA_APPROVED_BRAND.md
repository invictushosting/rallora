# Rallora approved identity | implementation source of truth

**Source:** `Rallora_Brand_Guidelines_v1.pdf`, and
`Rallora_Complete_Brand_Pack.zip` in the Padel League App Project Library,
dated September 2026. The approved logo is artwork; do not draw a plain `R`
or typeset "Rallora" and present either as the finished identity.

## Exact brand specifications
- Deep navy: `#061A39`
- Electric cyan: `#00B0FE`
- White: `#FFFFFF`
- Cool mist: `#E8F2F9`
- Typography for product UI: Inter; Lato as fallback
- Mark: recognisable padel racket integrated into the R monogram.
- Signature mark is **flat navy + electric cyan**, never a gradient.
- The source artwork includes custom wordmark; preserve lockup proportions.
- Use supplied horizontal lockup in wide headers (minimum width 160px),
  symbol in square avatars/app icons (minimum size 32px), and stacked
  lockup at minimum 220px wide.
- Clear space: >= 1/4 mark width; do not stretch, outline or add effects.
- Proposed campaign line "PADEL, CONNECTED." is provisional, not
  permanently adopted without sign-off.

## Website implementation status
- Applied exact colours to the Rallora platform homepage, platform control
  centre, shared club centres, club admin UI, browser theme and PWA manifest.
- Club pages retain their own individual colour accents in league content;
  master Rallora identity remains navy/cyan.
- **Original official logo/artwork, exported favicon, PWA icon PNG, and social
  share artwork are NOT in this repository yet.** The older GSM PWA icon
  assets remain at `public/icon-192.png` and `public/icon-512.png`.
  The temporary letter-R elements are NOT official logos.
- When the complete brand ZIP raw bytes are available, install the exported
  PNG/SVG assets into `public/brand/`, replace temporary header marks with
  the official lockups, update icon/manifest references and OG asset,
  and validate on dark/light/mobile headers. Do not auto-trace a new mark
  from memory when the approved original exists.

## Avoid
- A new visual identity instead of approved artwork.
- Replacing the club-specific GSM crest with Rallora's mark within GSM
  club-specific competition displays.
- Committing proprietary font files; CSS fallback fonts are enough.
