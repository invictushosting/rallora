# Server-enforced launch readiness

Activation now requires closed registration, at least one division, two active pairings in every division and a valid non-cancelled fixture for every active pairing. A fixture counts only when both opponents belong to its division and season. These checks run in a database trigger for direct inserts/updates as well as the organiser activation RPC.

The RPC retains the existing one-active-competition behaviour: it completes the previous competition and activates a ready draft atomically. If readiness fails, the previous active competition is unchanged. A per-club row lock serialises activation attempts. Direct writes cannot create a second active competition; organisers use the existing activation control for the atomic switch. Cycles with a successor cannot be reactivated from a completed/draft state.

No existing active season is rewritten or revalidated by installing the migration. Unrelated edits and idempotent active status calls retain their existing behaviour. New competitions must begin as drafts. The pilot checklist now reflects the draft registration → approval/closure → fixtures → private preview → activation sequence.

Regression coverage includes active inserts, direct status updates, missing divisions, undersized divisions, missing/cancelled fixtures, registration still open, signed-out/cross-club requests, failure rollback, valid/idempotent activation, competing active seasons and historical cycles. Production checks use rollback transactions; the private verification league is not activated for real.
