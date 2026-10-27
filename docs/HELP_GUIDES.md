# Maintaining Rallora help

The public help centre is `/help`. Individual articles are `/help/<article-slug>`.
Club links carry `?club=<slug>` to keep navigation tied to the current club.

## Shared content

`lib/help.ts` contains article titles, summaries, keywords, instructions, related
articles and the review date. The public pages and the floating helper both use
this content. Update it in the same change whenever the registration, account,
captain, booking, result, competition, placement, reminder or integration flow
changes. Check actual UI labels and current behaviour before changing guidance.
Update `HELP_REVIEWED` only after reviewing the guide content against those flows.

The helper searches these articles locally, shows the relevant instruction
section, and links to the full guide. It does not call a model, read account or
club records, fetch bookings or submit actions. Do not imply that it knows the
visitor's personal registration, booking, score or permissions. Questions remain
in React memory and disappear when the page is reloaded or the user clears them.

## Entry points

- Homepage footer: all guides.
- Club footer: all guides with club context.
- Club admin shortcuts: organiser getting-started guide.
- Captain centre: captain access guide.
- Integrations: Playtomic setup guide.
- Floating helper: page-specific suggestions and a link to all guides, including
  on the GSM club hub.

## Late registration guide

The club admin deadline override is explained in `/help/add-late-team` and linked from `/clubs/<slug>/admin/late-entry`. Both routes need to remain accurate when team registration or fixtures change.

The override adds a **pairing**, not a single replacement player. The captain must have an account. An existing pairing must originate in another competition at the same club. New partner invitations require claiming, and fixtures already generated are not automatically rebuilt. Recommend checking fixtures and preserving existing results.

## Validation

Run `node --experimental-strip-types --test tests/help.test.mjs`, typecheck and
build. The tests check common questions, relevant answer sections, related-guide
links and validated club context. Check narrow layouts, keyboard focus, Escape,
empty searches, filters, guide links, unknown-article 404s and the helper on the
GSM hub when browser preview is available.

Keep external provider setup instructions qualified when account menus or plan
entitlements may differ. Do not publish credentials, claim a court is booked by
Rallora, promise a pairing from a waiting list, or label an unconfirmed result as
official.
