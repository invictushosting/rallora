# Social Studio browser acceptance

Status: blocked locally on 21 November 2026 by Chromium socket restrictions. Run against an isolated fixture/test-data environment before any live release. Do not use production player edits for testing. Keep the work local unless separately authorised.

## Setup

- Start the current application with an isolated Supabase test project or a synthetic intercepted source. Use the existing club and player routes, not the simplified offline gallery.
- Prepare owner/admin/organiser, ordinary player, suspended member and another-club accounts. Keep fixtures and club media synthetic.
- Prepare two clubs with distinct logos/colours, more than two leagues, more than 400 fixtures, a corrected score, long names, zero scores, draws, a 13-result round and nine-row table.
- Prepare open, upcoming, closed and hidden registrations; a deadline about to expire; upcoming published, private, cancelled and past events; active/inactive and foreign-scoped sponsors; private and active successor cycles with actual movement links and a subsequently changed pairing.

## Club studio

- At desktop, 390px mobile and keyboard-only: sign in, select each league, source and all twelve designs. Confirm labels, focus, contrast, no horizontal overflow and readable long names.
- Inspect Square, Portrait and Story. Download real PNG files and check dimensions and preview/content equality. Check missing/failed/cross-origin assets, image type/size rejection and interrupted photo loads.
- Check every grid/carousel/table/movement page, including the last partial page. Ensure no selected source record is lost and page numbers are correct.
- Check club/profile/logo changes, sponsor selection changes during loading, page/source/format changes and draft review reset. A previous sponsor's logo must not appear for a new source.
- Correct/remove/add a confirmed result, alter a roster/table or revoke publication after review. Handoff must block and rebuild. Change the editor or league while a check/download is pending; old content must not download.
- Exercise deadline expiry/count changes while a check is pending; no expired open-entry graphic or stale countdown should be handed off.
- Verify event cards do not invent times/prices; draft/cancelled/past events are absent. Verify sponsor scope and optional-source errors. Verify promotions come from stored active-cycle links, not current standings or private next-cycle drafts.
- Revoke the role, suspend the club or switch account while reviewing. Handoff must stop. Re-login must not restore another user's private working state.
- Block clipboard/download permission and simulate source/network errors. Feedback must not claim a successful copy, download or publication.
- Confirm session-only workspace behaviour, photo removal on league change and the legacy news editor's separate draft restoration/clear/expiry behaviour.

## Player sharing

- Open a public confirmed/released result. Use the share dialog by keyboard and on mobile, inspect each supported size/frame and download PNG/copy caption.
- Confirm a pending/disputed/future/cancelled/unpublished fixture cannot be handed off. Correct scores/names while the dialog is open and verify rejection.
- Check long names, zero values, draws and non-numeric outcomes. No contacts, precise booking information or private chat enters artwork/captions.

## Evidence

Record tested commit, browser/device versions, fixture source, each result and any failure. Save synthetic evidence and correct defects before marking acceptance passed. No publishing, scheduling, OAuth connection or paid AI test is included in this acceptance step.
