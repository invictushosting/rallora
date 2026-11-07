# Rallora processing inventory — evidence and open questions (27 October 2026)

This is a **working Article 30-style record**, not a completed inventory.

| Activity | Potential role | Categories | Lawful basis | Recipients / transfer | Retention |
|---|---|---|---|---|---|
| Independent Rallora player account | Provider controller (verify) | Email, name, account metadata | Contract / legitimate interests as applicable (assess) | Supabase and hosting vendors (verify) | TBD |
| Club competition registration | Club controller / Provider processor (verify) | Member/team identities, ratings, fixtures | Club to determine; processor follows instructions | Club administrators | TBD |
| Club subscriptions and admin | Provider controller (verify) | Contact, subscription info, billing records | Contract/legal obligation as applicable | Billing vendors (verify) | TBD |
| Player discovery / future Rallora Social | Role and notices TBD | Profile choices, posts, photos | Assess before enabling | Other users/sponsors only with clear rules | TBD |
| Playtomic integrations | Determine roles and authorised API terms | Rating links and booking/club data | Assess | Playtomic where authorised | TBD |
| Support and operational mail | Provider controller or processor depending on purpose | Messages and email addresses | Assess per context | Mail provider (verify) | TBD |
| Security and incident logs | Provider controller (verify) | Login data / IP / device where captured | Legitimate interests/security assessment | Vendors (verify) | TBD |

## Confirm before privacy documents can be published
- Name/address of actual controller per activity, contact routes and UK representative/DPO if required
- Special-category data, children's access and safeguarding risks
- All analytics, cookies, marketing and tracking actually installed
- Categories and recipient contracts, locations, onward transfers and UK safeguards
- Documented retention schedule (including backups and inactive accounts)
- Process for subject access, deletion, objection and identity verification
- Security incident handling, accountability, DPIA threshold assessment
- ICO fee assessment and procurement of any required registrations

## Current feature additions — 7 November 2026
The following extends the inventory for features now in main; proposed bases and roles still require accountable approval.

| Activity | Data / source / people | Intended recipients | Proposed role / basis for review | Retention decision |
|---|---|---|---|---|
| Fixture chat and time proposals | Messages, participant IDs, proposal times, court and organiser-help requests; written by current players | Current fixture players and authorised club organisers; notification provider for permitted alerts | Club-controlled competition operations, Protego processor; club documents basis, Protego assesses independent security use | Competition/dispute window plus justified deletion of message text; separate sporting results from chat |
| Both-player match actions | Booking/score submissions, confirmations/disputes and actor attribution | Fixture players, organisers and permitted public sporting views (verify actual fields) | Club controller/Protego processor for sporting administration; audit/security basis separately documented | Preserve contest/dispute integrity; approve identifiable archive duration |
| Searchable player support workspace | Account/club/league context, access checks, invitation history/resends, ticket/action history, private screenshots | Restricted platform support admins; service providers required for support | Case-dependent club data assistance and Protego's own support/security records | Ordinary ticket closure + proposed 12 months; attachment minimisation; holds reviewed |
| Incoming/outgoing ticket email | Contact address, text, provider references and threading tokens; potentially forwarded third-party content | Support operators, intended correspondent, Resend; normal mailbox uses Workspace | Review controller role per case; necessary service support/legitimate interests subject to balancing | Approve body/attachment/provider-log periods; deduplication metadata separately |
| Club contacts export | Names/contact details and league context in an organiser-requested export | Authorised club admin; downstream handling controlled by club | Club instructions/DPA; no automatic permission for marketing | Secure transfer, minimised export and club deletion instructions |
| Browser registration and Social Studio drafts | Form draft including partner data in sessionStorage; user/club draft content in localStorage | Device/browser user; not sent until the relevant form action | Requested continuity functionality; PECR/GDPR assessment per purpose | See browser-storage inventory; persistent Social drafts currently have no automatic expiry |

Sources and supplier/transfer checks: `storage-and-cookie-audit-2026-11-07.md`, `supplier-evidence-register-2026-11-07.md`. Free-text/screenshot inputs can contain unexpected sensitive information; discourage unnecessary disclosure and provide proportionate redaction/restricted handling. No special-category lawful basis is presumed.
