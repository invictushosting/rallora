# Clearer scores and inline result corrections

Result cards now show each pairing and its set scores in the same table row. Home and away labels stay fixed to the fixture. The public hub, Match centre and admin result details share the same score table, including winner/draw labels.

Players enter games in separate set cells beside the pairing names. Their own pairing is marked. Unplayed sets stay blank; incomplete or skipped sets are rejected. Players explicitly choose the winner or Draw and review a named score table before submitting. Save failures keep their entry available to retry.

Signed-in club organisers can press **Edit result** directly on a public result card, beside **See result** in Club admin → Played, or inside confirmed result details. The dialog fetches the latest official score, allows a correction note, and includes **Swap scores between pairings** for reversed entries. Organisers review before saving. Dispute resolution uses the same set-entry form.

The existing `rallora_admin_resolve_result` RPC continues to enforce fixture access and historical-cycle locks, save the official result, and recalculate standings. No migration or permission change is required. Public cards refresh the score and standings without changing the current filters. Players continue to submit through the existing opponent-confirmation workflow.

Updated `/help/submit-and-confirm-results` and `/help/club-results`.

Validation: TypeScript, ESLint (existing warnings only), all 126 Node tests, and the production build. Production browser checks confirmed named score rows, organiser-only editing, loading the latest saved result, swapping scores, reviewing a correction and closing without saving. Player checks confirmed incomplete-set validation and the review step without submitting. A global 620px table minimum discovered in browser QA was overridden for both score tables so three sets fit the editor. Mobile-device QA remains outstanding. No live league scores were changed during development or these checks.
