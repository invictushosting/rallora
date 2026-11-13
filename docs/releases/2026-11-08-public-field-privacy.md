# Public fixture and contact privacy

Status: prepared; not deployed. This source change does not introduce an age-verification system or complete the children's privacy assessment.

Public league pages retain sporting names, ratings, standings, fixture deadlines and statuses. Recorded booking times and courts move to the existing signed-in Match centre/chat. Club contact lists continue to work through a season-scoped reader that checks the signed-in organiser's permissions before returning contacts. Existing row policies, player actions and messaging access rules remain in place.

## Required release sequence

Do not bulk-apply both migrations before deploying the compatible app. Existing frontend contact readers need the additive reader first.

1. Apply only `20261107235702_protect_team_contacts_and_fixture_locations.sql`. This adds the authorised reader without restricting existing reads.
2. Deploy this frontend. Confirm the club admin team and contact lists use the new reader and public fixture requests omit precise booking columns.
3. Apply `20261108000143_restrict_public_team_and_fixture_columns.sql`. This replaces broad SELECT grants with explicit public columns, including revoking any individual grants on protected fields. Retain service-role access and existing write grants.
4. Verify anonymous and unrelated signed-in API requests cannot select team email or precise booking columns. Verify public names/statuses/results still load; own-club organiser contacts work; another club and suspended organisers cannot call the reader; platform support works; current players can arrange matches, chat and submit/review results.
5. Record deployment and live verification privately. Complete the operational incident assessment and children's privacy decisions separately; do not publish operational evidence in this public repository.

## Verification

CI adds permission assertions against synthetic records, including actual rejected private-column SELECTs and scoped reader checks. The all-player match-action assertions run again after the restrictions. The fixture-schema helper only supplies a legacy court column missing from the synthetic fixture; it is not a production migration.

Local verification includes the application suite, TypeScript, production build, lint and disposable PGlite rehearsals of the SQL suites. The regression rehearsal omits the restriction migration and checks that the privacy assertions detect the previous broad grants. Hosted PostgreSQL CI and browser/API checks remain release gates.

## Rollback

Retain restricted grants and a compatible frontend. Do not restore broad SELECT grants as an automatic rollback. If an admin reader fails, fix or temporarily hide that view while preserving private-field restrictions. Do not drop player data, results or existing access policies.

## Remaining junior work

Review the proposed minimal age bands (under 16, 16–17, 18+) and treatment of existing/unknown accounts. A declaration is self-reported, not verified age. Complete the child-specific assessment, public junior identity policy and club consultation before relying on this for independent junior access. Younger managed participation and future Socials require their own assessed design.
