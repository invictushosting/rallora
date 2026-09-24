# First pilot club launch checklist

Use this checklist for every real pilot. Do not use the demo club as the starting point.

## Rallora platform
- Receive the club application through `/register-club`.
- Confirm club name, requested slug, main contact and pilot plan.
- Approve the application in Platform Control Centre.
- Confirm the club is active and the applicant has an active owner membership.
- Open the new club admin from Platform Control Centre.

## Club owner setup
- Add logo, cover image, welcome message, venue/contact details and player registration terms.
- Create the first season as a draft.
- Add all required divisions.
- Activate the season only when its division structure is correct.
- Open the team-registration link from the Pilot Setup panel and send it to captains.

## Registration
- Submit one real test team before broadly sharing the link.
- Confirm the captain account, partner details and Playtomic rating state are shown correctly.
- Approve the team into the intended division.
- Confirm the captain can open Captain Centre and the partner can claim their membership.

## League launch
- Create a test fixture with a publish date and play-by deadline.
- Confirm both teams and the public club hub show only the intended published data.
- Captain submits the result; opponent confirms it.
- Confirm the official result and standings update.
- Reopen/recover the test result once as an organiser, then restore the intended official result.

## Club communications
- Open Social Studio and generate a confirmed-result post/graphic.
- Confirm manual share/copy works on the club's intended device.
- Do not promise automatic social publishing in the pilot.
- Confirm reminder expectations: in-app notification generation exists; outbound email/WhatsApp delivery is not yet a launch dependency.

## Playtomic (eligible clubs only)
- Obtain the club's own approved Club API credentials and Venue ID through the agreed secure setup process.
- Configure server-side Rallora secrets before testing live player-rating sync.
- Verify a signed-in test captain matches by email and receives the expected PADEL `level_value`.
- Treat Playtomic as read-only: never promise rating or result write-back.

## Go-live check
- Run Rallora pilot readiness checks.
- Confirm there are no disputed fixtures, orphaned confirmed fixtures or tenant-access anomalies.
- Decide whether the pilot club needs access while global maintenance mode remains enabled; narrow/disable maintenance deliberately rather than as a side effect.
- Keep the first live league small enough to observe registrations, the first fixture and the first result closely.
