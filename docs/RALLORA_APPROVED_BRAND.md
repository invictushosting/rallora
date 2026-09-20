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
- After the owner supplied the approved `Rallora_Brand_Pack_Preview(1).png`,
  the **actual racket-R artwork and custom wordmark** were isolated from that
  approval reference into digital-only SVGs in `public/brand/`. The dark and
  light horizontal lockups now appear in platform and club headers, replacing
  the old temporary typed letter-R. SVGs are auto-traced from supplied artwork,
  not redrawn from memory.
- Replaced the legacy GSM PWA icons at `public/icon-192.png` and
  `public/icon-512.png` with Rallora racket-R PNG assets. Also installed a
  180px Apple touch icon, favicon.ico, dynamic-svg-compatible `app/icon.svg`,
  and 1200x630 Rallora-branded social preview. Updated Next metadata and
  colour theme to use the approved navy/cyan identity.
- The **original complete ZIP with the production vector/PNG exports is still
  not readable by the Project Library raw-byte materializer**. If accessible
  later, replace the auto-traced preview-derived SVGs with those original
  clean export masters. Do not use auto-traced assets for print, engraving or
  embroidery until inspected. Website assets are suitable for online preview.

## Avoid
- A new visual identity instead of approved artwork.
- Replacing the club-specific GSM crest with Rallora's mark within GSM
  club-specific competition displays.
- Committing proprietary font files; CSS fallback fonts are enough.
