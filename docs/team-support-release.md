# Team account links and withdrawals

## Release order

1. Run the application checks and the synthetic PostgreSQL checks in Rallora quality gates. Review the withdrawal UI at desktop and mobile widths.
2. Confirm the target Vercel project is linked to this repository and record the currently serving deployment. Record the live Supabase migration ledger and security advisories.
3. Apply the withdrawal migration, then the account reconciliation migration, in version order. Verify both migration records, RPC signatures, permissions and policies. The migrations create features and leave existing team, invite and fixture rows alone.
4. Release the tested commit through the existing Vercel deployment. Verify the public hub, Match centre, admin withdrawal page and Help & Guides against the released commit.
5. Apply the club-specific update separately after checking the team, round, division, fixtures and results. For a pre-cancelled fixture, an immediate withdrawal records the original cancelled status and converts it to a bye. Leave the promotion override blank to retain the competition setting and save zero relegation for the selected division and round.
6. Verify the selected fixtures have no results or submissions and no outstanding competitive actions. Confirm the original booking and recorded results still exist. Compare the affected division and round against other divisions and future defaults.

## Rollback

If a migration fails inside its transaction, PostgreSQL rolls back the transaction. Confirm the migration ledger and database objects before retrying.

If the application release fails before the club-specific update, return traffic to the previous Vercel deployment. The additive objects can stay in place while troubleshooting. The previous UI uses the existing invitation claim signature, which the reconciliation migration preserves.

If reverting account linking, disable the deferred `reconcile_new_partner_invite` trigger and restore only the prior definitions of `public.rallora_claim_team_invite(uuid)` and `rallora_private.assign_roster_slot(uuid,integer,jsonb)`, using the function bodies in migrations `20261022134202` and `20261028101027`. Do not rerun those whole migrations. Preserve links already verified and granted. Disable execution of the new reconciliation RPCs after reverting the application.

If reverting after withdrawals go live, pause progression and fixture edits for affected competitions while reconciling business state. Export the withdrawal, fixture mapping and movement audit records to approved internal storage. Before serving the prior application, use a reviewed compensating migration to map affected bye fixtures to cancelled, keeping booking, team and official result history. Preserve existing withdrawals and review scheduled withdrawals and movement overrides separately because the previous progression function will not apply them. Restore the prior function bodies individually for `rallora_private.create_next_cycle` from `20261019084951`, `rallora_private.fixture_context` from `20261021123430` and `rallora_private.save_arrangement` and `rallora_private.generate_reminders` from `20261106081243`. Disable the new write RPCs and bye guards only as part of the reviewed rollback. Record the compensating migration in the ledger and verify the old app and affected fixtures before resuming progression.
