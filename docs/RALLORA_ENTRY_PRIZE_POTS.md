# Rallora Leagues: paid entry & prize pot feature

Status: **planning UI + synthetic staging SQL only**. Rallora does not take,
hold, refund or distribute player money. No fee configuration is attached
to a live season yet. Do NOT label a forecast as "collected" or "available to pay".

## Product: a season-level optional feature of Rallora Leagues

A club chooses **free** or **paid** entry for each season/competition, never
as a forced platform-wide default. Paid pricing may be per pair/team or per
player. Choose one currency per season and publish the amount, fees, entry
deadline, eligibility, refunds/cancellations, prize composition, split and
who owes any guaranteed-pot shortfall BEFORE opening paid entry.

Three modes:
- No prize fund: club keeps the fee proceeds less authorised costs.
- Percentage funded: choose a percentage of net collected entry receipts
  to the pot; sponsor funds contribute in addition.
- Guaranteed: a fixed prize committed by the organiser; any shortfall
  after actual net receipts and confirmed sponsor funds is the organiser's
  liability, not a Rallora promise.

Our **illustrative planner** uses forecast paying teams/players and a club's
currently listed number of teams as a starting estimate, not confirmed paying
registrations. All calculations use exact currency minor units; percentages
round down and remaining pence goes to the final prize place. Supported
planning currencies at present: GBP, EUR and USD only. No FX transfers.

A typical *illustrative*, not automatic setting:
20 pairs × £25 per pair = £500 projected entry income.
If zero payment/provider fees and 80% net set aside for prizes,
projected prize pot = £400, club balance = £100.
With 60/30/10 prize split: £240 / £120 / £40.
Real provider fees and refunds change this example.

No Rallora transaction fee has been set. Provider cost fields are user
inputs, not a quote or approval. Never advertise zero fees as a promise.

## Development sprint: choosing payment methods and prize formats

A club-only, ephemeral **Collection Methods** panel now exists beside the
Entry & Prize Pot calculator, accessible only through the verified organiser
dashboard. It lets a club plan bank transfer, cash at club, or both, and
shows Stripe Connect, Mollie Connect, PayPal, Revolut Business and Adyen
clearly as future integrations, NOT connected processors.

The club can draft eligibility, refund and cancellation wording and note
cash, physical/voucher/coaching, or mixed prizes. Example setup text can
be copied, but is not published or persisted; the page collects NO IBAN,
account number, merchant token or card information. Non-cash prizes are
not added to the numeric cash pot. The prize budget calculator is still
independent, so clubs should choose **no cash prizes** there if their event
awards only physical items; unify the two configurations before real season
publication.

`lib/leagues/payments.ts` supplies a typed provider catalog, readiness
checks and an *internal-only* verified-event payment-state model.
No registration or client request can automatically mark itself as paid.
A real server must validate receipt authenticity, club, competition, amount,
currency and registration against trusted sources before adding an event.
Duplicate notifications cannot count twice; conflicts fail closed.

Proposed extra tables `scripts/staging/005_payment_options_noncash.sql`
record club/season-scoped payment-method and physical prize drafts.
No browser role is permitted to mark merchant approvals or delivery complete.
Synthetic two-club CI tests are NOT a replacement for real Supabase staging.
The code does not submit payment forms, connect merchant accounts, hold funds
or write payment details to any live database.

## Phase 1: club-managed collections, Rallora tracks only after approval

Consider an optional organiser-managed offline route with explicit manually
reconciled receipt records after the database/staging/security work. Show
"payment pending", "reconciled", "refunded", "disputed" separately. An admin
clicking "paid" is not a verified bank receipt: require source, date,
amount, currency, actor and an auditable correction/reversal trail. Never
collect card credentials or private banking details in notes.

**No offline status writer is enabled in current code.** The initial planner
is read-only and stores nothing in Supabase.

### Staged manual receipt reconciliation (not a live feature)

`scripts/staging/006_manual_receipt_ledger.sql` defines a proposed
append-only receipt audit for an approved bank-transfer or cash-at-club
option. A future trusted worker would write only after an authorised club
owner/admin checks evidence, amount, registration, currency and source. Each
unique source reference must be fingerprinted server-side, not saved as a raw
bank statement reference; the same source cannot be counted twice within
the same club and season. Correct an erroneous receipt with a same-club,
same-registration reversal, never by overwriting the original.

Browser sessions, captains and ordinary organisers receive no INSERT,
UPDATE or DELETE privilege. Only owner/admin and platform operators
can read the detailed receipt audit. The synthetic CI fixture tests
duplicate reference, unapproved method, foreign-club verifier, cross-club
references, reversal, immutability, and suspended-user visibility. **No
real Supabase migration, receipt verifier API or live paid-registration
status update is enabled.** The original payment-events ledger in 004 and
the manual audit in 006 will need a single reconciler for actual balances
before a real checkout or money dashboard can launch.

## Phase 2: optional integrated checkout, only after written provider approval

One possible architecture is a provider-managed connected-club onboarding
and explicit Rallora platform fee; this is NOT automatically allowed for
cash-prize tournaments. Obtain provider approval describing the exact
sport, jurisdiction, entry and prize model and whether Rallora or the club
is merchant of record / bears refunds, chargebacks and payout risk.

Never automatically label a Connect balance "ring-fenced escrow". Generic
Connect balance separation does not itself provide an escrow licence or
protected prize trust. Use approved payment/payout products, not a platform
wallet with self-described safeguarding promises.

A captured payment requires a verified provider webhook with replay-safe
unique event ID and a server-side registered payer/entry record. Keep:
- total charges less refunds, partial refunds, disputes and processing fees;
- platform fees actually charged and net available by club/season/currency;
- sponsor *promises* separate from sponsor money actually received;
- outstanding guaranteed-pot top-up, expenses and proposed award amounts;
- published winners, verified recipient, two-person payout approval and
  real payout/transfer receipt.

A price change after a payer registers should not rewrite their fee
snapshot; future registrations get the newly approved terms. Define partial
team withdrawals, duplicate entries, cancellation and event minimum teams.
Publish an update if changing prize terms; log version and acceptance.

## Phase 3: Interclub

An invitation competition gets its **own** paid-entry rules, host responsibilities
and accounting currency. Local club season money never silently becomes an
Interclub prize. Record who owns a joint event, which clubs sponsor or fund
it, where awards are paid, eligibility/age rules and how refunds work if
another club withdraws.

## Compliance / payment provider gate

Do not classify every real sporting competition as unlawful gambling; status
depends on actual rules, jurisdictions and how winners are determined.
But check the paid-prize and any random-draw mechanics with qualified UK
advice before taking money. The UK Gambling Commission says genuine prize
competitions depend on skill, judgement or knowledge and warns organisers
to check lawful classification:
https://www.gamblingcommission.gov.uk/public-and-players/guide/page/free-draws-and-prize-competitions

Stripe's current prohibited/restricted policy includes some fee-paid games
of skill with cash or material prizes; legality alone does NOT guarantee
provider eligibility. Stripe requires explicit prior approval for some
otherwise unsupported business cases:
https://stripe.com/legal/restricted-businesses
https://support.stripe.com/questions/prohibited-and-restricted-businesses-list-faqs?locale=en-GB

Connect 'separate charges and transfers' makes platform refunds/chargebacks
and processing-fee liability significant and is not proof that restricted
competition use is approved:
https://docs.stripe.com/connect/separate-charges-and-transfers

Before enabling collection, agree supported countries, tax/VAT treatment,
consumer cancellation/refund terms, safeguarding/holding structure,
minor entrants, anti-fraud limits and bank/payout identity checks.

## Implementation / safety

- `lib/leagues/prize-budget.ts`: pure exact-pence projection engine.
- `app/clubs/[slug]/admin/prize-planner.tsx`: gated organiser forecast;
  all inputs are ephemeral, not actual season configuration.
- `scripts/staging/004_league_entry_prizes.sql`: proposed club/season
  fee rules, separate registration, payment events and award tables.
- `scripts/staging/ci_league_prizes_assertions.sql`: two-club RLS,
  non-author edit, duplicate event and wrong-season roster checks.
- `tests/leagues-prize-budget.test.mjs`: projection and allocation tests.
- NO production migration, provider credentials, checkout, payment webhook,
  payout, wallet or user charge have been performed.
