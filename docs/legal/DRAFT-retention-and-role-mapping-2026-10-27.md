# Rallora retention and responsibility decision worksheet — DRAFT (27 October 2026)

**Status: pending business owner and UK legal approval.** No period below is current company policy. The options are proposed starting points for discussion, **not GDPR rules**, and they must not be implemented as automatic deletion. Reference ICO storage-limitation guidance: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/ . UK GDPR has no single prescribed retention interval for these datasets; purposes and legal obligations determine justifiable durations.

## Controller and processor decision matrix (proposed assessment, not legal conclusion)

| Processing activity | Likely decision-maker / accountable business role to designate | Verification needed |
|---|---|---|
| Independent Rallora account registration, login and platform security | Protego privacy owner, likely provider controller | Is account usable independent of club; lawful basis, terms/version, auth logs and support contacts |
| Club-specific registrations, team eligibility, fixtures/results and standings | Club competition contact likely controller; Protego likely processor for club-instructed operations | Actual power to set purpose, rules, access, published results, and retention; DPA instructions |
| Club onboarding, SaaS subscriptions, billing and platform support | Protego commercial/privacy owner, likely controller for vendor/account operations | Separate club customer contact data and statutory financial duties |
| Support issues about club-controlled league data | Case-by-case: relevant club may control underlying sporting data while Protego independently controls security/support administration | Routing, access to case files and basis for retention |
| Cross-club discovery, platform social profiles and promotional features | Protego product/privacy owner likely controller for independently designed features | Feature activation, profile visibility, consent/legitimate interests, children, objection and marketing controls |
| Club communications delivered through Rallora | Club contact potentially controller, Protego processor, except service security/billing messages | Distinguish required competition messages from optional marketing |
| Privacy rights request processing, case evidence and security incident response | Controller for affected underlying activity; Protego responsible for its own platform records and processor assistance | Staff lead and club escalation map; statutory clock assessed individually |

The legal distinction depends on **who actually decides purposes and essential means**, not the contract label. ICO reference: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/controllers-and-processors-a-guide/

## Retention options for approval — no live action

| Record category / verified examples | Decision needed / possible planning approach | Trigger and safeguards | Owner to nominate |
|---|---|---|---|
| Auth accounts, core player profiles (`auth.users`, `rallora_player_profiles`) | Proposed: retain while account active; review after 12 months of inactivity, notify before any qualifying deletion, agree final inactive grace period | Latest login/account state; check unpaid obligations, minors, pending competition and identity requests | Provider privacy owner |
| Club teams, league registrations and member rosters (`rallora_team_registration_requests`, `team_players`) | Proposed: keep for league and defined dispute/appeal window; ask clubs whether historical identifiable rosters need longer archival | Season close, appeal resolution and controller instructions; pseudonymise if identifiable link no longer needed | Club controller + Protego processor lead |
| Fixture results and standings (`results`, `result_submissions`) | Proposed: keep historical league results where legitimate sporting archive need is documented; review whether player identifiers can be removed separately | End of season and dispute handling; preserve sporting integrity without indefinite identity linkage | Club competition controller |
| Support cases (`rallora_support_requests`) | Proposed candidate: closure + 12 months for ordinary issues; exceptions for unresolved litigation, abuse/security or legal duty | Close date, escalation and proportional redaction of attachments/free text | Provider support/privacy lead |
| Notifications and delivery attempts (`rallora_notifications`, `rallora_delivery_queue`) | Proposed candidate: successful operational delivery metadata up to 90 days unless needed for documented incident investigation; separate retention for legally significant notice evidence | Provider acceptance vs receipt, failure diagnostics, campaign or competition needs; never purge untriaged failures | Engineering operations/privacy |
| Privacy rights request evidence (`rallora_privacy_requests`, private review/outbox events — drafted only) | Do not use a blanket period yet; define a defensible post-closure evidence window with legal counsel and erase superfluous identity documents as soon as feasible | Closure/appeal, legal claims and ability to demonstrate action; minimise request text | Provider privacy lead + counsel |
| Authentication and security logs | Propose short rolling diagnostics window plus event-specific legal holds; verify vendor-side retention and security need | Event timestamp, incident retention, contractual processor access and any cross-border transfer | Security lead |
| Club commercial subscription and financial records | Accountant/counsel must set legal accounting and tax retention; not inherited from league record periods | Statutory tax/accounting trigger and legal entity jurisdiction | Finance owner |
| Backups, replicated media and exports | Establish backup generation/expiry by vendor, irreversibility checks and exception-handling; do not promise immediate backup deletion | Scheduled backup rotation, incident recovery, legal hold; verified vendor policy | Infrastructure and procurement |
| Rallora Social content, player discovery and Playtomic link records | No default timer without validating enabled features; account deletion, consent withdrawal, club instruction and API permissions require separate paths | Feature use, visibility choices, licence and profile ownership | Product/privacy owner |

## Decisions that require explicit organisational approval
1. **Name a primary privacy lead and backup** authorised to monitor `support@rallora.app` and `/platform/privacy` every business day; publish escalation channel for leave/weekends. Do not assume mailbox routing currently works.
2. **Confirm role mapping per activity** with pilot clubs (including Carbon Padel where appropriate) and agree Article 28 instruction/assistance, controller contact and breach escalation.
3. **Approve measurable periods** for each above class after checking actual purpose, legal duty, disputes, data-subject expectations, minimum necessary fields, vendor backup policy and the cost of deletion.
4. **Define inactivity review method** without deleting accounts used in active competitions or orphaning fixture history. Assess account-to-player foreign keys and exports before coding deletion.
5. **Approve privacy request case-handling evidence retention** and manual/automated notification failure escalation; provider email acceptance ≠ staff acknowledgement.
6. **Confirm vendor register** covering Supabase, Vercel, Resend and Workspace as applicable, with contracts, locations and onward transfers verified (not guessed).
7. **Owner signs a retention change ticket before any destructive database migration, scheduled purge, media cleanup or user deletion**. Rollback must preserve legally required records.

## Evidence from read-only production schema (not row contents)
On 27 October, Rallora production had tables named `players`, `rallora_player_profiles`, `rallora_team_registration_requests`, `team_players`, `results`, `result_submissions`, `rallora_support_requests`, `rallora_notifications`, `rallora_delivery_queue`, `rallora_player_discovery`, and `rallora_playtomic_player_links`. This confirms data categories to inventory, not retention settings or whether a feature is enabled.

## Release safeguards
No automatic purges, scheduler changes or forced legal acceptance until a final retention register, measured collection/use, controller instructions, privacy-review monitoring, processor obligations, security assessment and written authorisation are obtained. Existing draft terms remain unapproved.
