# Organiser and captain result controls

The club admin overview includes organiser overrides in its official result counts and displays their scores. The Fixtures tab now exposes the existing Result recovery operations with pairing labels, score/winner fields and a confirmation before reopening an official result. Recovery excludes cancelled fixtures and seasons with a prepared successor; archived fixture scheduling controls are disabled as well.

Captains see the official confirmed or organiser-corrected score before any older submission. Submitted scores are labelled SUBMITTED until confirmed. The latest submission is selected consistently, and disputes remain with the organiser. Completed cycles are read-only. Review buttons are disabled during requests and never offer self-confirmation for a submission the viewer authored. Pairing changes discard stale fixture displays, with a request version guard preventing an earlier load from replacing the newly selected pairing.

Validation: six regression tests cover corrected scores, unordered submissions, self-confirmation display, completed/draft cycles, disputes and new open fixtures. The full JavaScript suite has 40 passing tests. Hosted typecheck, lint, production build and database regression gates are required before merge. Live email receipt remains deferred at the user's request.
