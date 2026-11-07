# Junior participation and public league pages — design and DPIA screening

7 November 2026. DRAFT implementation requirements; not a completed DPIA or legal sign-off.

## Confirmed product decisions
Ste selected **Include under-18s** and **Keep public** league pages. Do not implement the superseded adult-only proposal or restrict all league pages to signed-in users. These decisions establish product scope; they do not choose the youngest age, verify parental responsibility, authorise unrestricted public disclosure of children's identities/location or settle the lawful basis.

## Current implementation evidence
The reviewed application/migration source has no observed structured age-band, date-of-birth, guardian or parental-authority flow (keyword review 7 November). Existing partner/captain invitations are membership links, not proof of age or parental responsibility. No age is inferred from names, ratings, email addresses or existing team data. No child records were identified/read in production for this review.

The platform includes participant match chat, proposals/bookings, public sporting information, organiser contact export and Social Studio. Those capabilities require a child-specific data-flow and safeguarding review before the junior scope can be declared ready.

## DPIA screening outcome
Treat junior access as intended and plan against the ICO Children's Code unless the documented legal scope assessment establishes otherwise. Scope includes accounts, partners entered by another person, publication and third-party recipients, fixture time/location, chat with adults, invitations, exports, support screenshots/free text, marketing/discovery and controller responsibilities. Complete a children's DPIA with club involvement before activating the final policy; owner product choices are not a substitute for that assessment.

## Design requirements and decisions
| Requirement | Proposed implementation direction for review | Evidence needed before completion |
|---|---|---|
| Youngest age / accounts | Ask youngest intended participant and whether each band has own login or guardian-managed participation; use proportionate age assurance, collect an age band if sufficient rather than full DOB | Owner/club scope, legal/safeguarding review and verified account design |
| Guardian authority | Keep guardian identity/relationship/permissions separate from team captain role; verify authority proportionately where required | Lawful basis by purpose; where relying on consent for an ISS offered directly to an under-13, verified parental authorisation requirements apply |
| Public league pages | Preserve public league access; assess limited junior display names/identifiers and permitted sporting fields with high-privacy defaults and a documented child-best-interests assessment for any different default | Club controller decision, approved notice, lawful basis, withdrawal/objection process where applicable; no automatic public full-name profile from a captain invitation |
| Fixture location/time | Review whether public schedules or arranged bookings reveal a child's whereabouts; show only justified public sporting details and keep detailed arrangements restricted as appropriate | Actual public data/API inventory plus negative-role/browser tests |
| Match chat and contact export | Retain fixture scoping, reporting/organiser help and removal controls; define safeguarding supervision and guardian access without sharing credentials | Club safeguarding lead, escalation, export restrictions and role tests |
| Discovery, promotion and imagery | Separate necessary participation from optional cross-club discovery, sponsor use, marketing, photographs and promotional posts | No bundled consent; approved age-appropriate choices and any required authority/consent evidence |
| Transparency / rights | Short child-readable explanation of public fields, chat recipients, reporting and rights; permit proportionate child/guardian requests | Comprehension review, controller routing, identity/authority tests and secure fulfilment |
| Existing accounts | Handle unknown ages deliberately; no automatic adult classification or silent retroactive consent | Migration/rollout plan that preserves live fixtures/results, minimal age collection and notice/acceptance journey |
| Retention / security | Apply approved child-specific minimisation, archive/deletion and incident arrangements | Retention approval, restricted access, logs, restore/reapplication tests and accountable owner |

## Release acceptance scenarios
Test synthetic accounts only: adult, each supported junior band, unknown-age existing player, verified guardian, unrelated adult, opponent, club admin and platform admin. Verify public view and direct APIs cannot reveal restricted junior identity/contact/location/chat/support fields; guardian privileges cannot be claimed through editable Auth metadata or captain status; pairing changes/removal invalidate access; reporting routes and rights requests work; public league pages remain available with the approved sporting fields.

## Primary guidance checked 7 November 2026
- Scope: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/services-covered-by-this-code/
- High privacy defaults: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/7-default-settings/
- Lawful basis and conditional under-13 parental consent: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/annex-c-lawful-basis-for-processing/

Do not misstate age 13 as a universal minimum signup age or say parental consent is required for every processing activity concerning every under-18. Determine the actual basis, contractual capacity, safeguarding duties and Children's Code controls for each activity.
