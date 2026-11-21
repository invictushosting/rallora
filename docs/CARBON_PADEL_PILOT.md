# Carbon Padel Club — pilot configuration (NOT LIVE)

This branch introduces a standalone, testable rules engine for Carbon's proposed five-division pilot. It is **not wired to the UI, database, authentication, or deployment**. Do not represent Carbon as activated.

## Competition
- Diamond (4.5+): Wednesday, 19:00–21:00
- Kevlar (4–5): Monday, 19:00–21:00
- Steel (3–4): Tuesday, 19:00–21:00
- Ivory (2–3): Thursday, 19:00–21:00
- Graphite (1–2): Friday, 19:00–21:00
- Six teams per division, five simultaneous-court rounds (three matches each) per week, for six weeks.
- Each match is exactly six games with a mandatory independently awarded bonus tiebreak.
- One serve (fault loses point), let serves played on, golden point at deuce.
- Round targets are twenty minutes; no hard stop. Three-minute rest after overrun. The final 20 minutes is a nominal buffer, **not guaranteed**.
- Standings: league points (3/1/0 + 1 tiebreak bonus), wins, game difference, tiebreaks won.

## Outstanding launch gates
1. Obtain club-owner approval and create Carbon in Rallora's controlled onboarding process.
2. Confirm three simultaneous courts, actual season start date, the tiebreak format (points-to-win / win-by-two), and whether teams retain the same partners all six weeks.
3. Confirm promotion/relegation counts, edge divisions, and any final unresolved ties.
4. Map the pure module into the existing competition schema, authorized server-side result validation, match confirmation and admin corrections.
5. Apply only reviewed, tenant-isolated migrations as needed; do not enable global club writes.
6. Add approved slug to pilot allowlist only after successful staging end-to-end tests.
7. Run npm run check and preview checks before merging this branch to main.

No actual results or team rosters are included.
