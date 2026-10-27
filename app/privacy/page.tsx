import Link from "next/link";

export const metadata = { title: "Privacy information | Rallora" };
export default function PrivacyPage() {
  return <main style={{maxWidth:760,margin:"0 auto",padding:"48px 24px",lineHeight:1.7}}>
    <Link href="/">← Rallora</Link><h1>Privacy information</h1>
    <p><strong>Draft for legal and operational review — not approved for publication.</strong></p>
    <p>Rallora is operated by Protego Solutions Ltd (company number 12924277), Minshull House, 67 Wellington Road North, Stockport, England, SK4 2LP. For privacy questions contact <a href="mailto:support@rallora.app">support@rallora.app</a>.</p>
    <h2>Information used</h2><p>Depending on features used, Rallora processes account names and emails, optional player profile details, club and team membership, league entries, match results, invitations, notifications and support messages. The relevant club may separately decide how its competitions are administered.</p>
    <h2>Purposes and legal bases</h2><p>Account and service delivery, league operations, support, security, and legal obligations are the intended purposes. Legal bases and controller/processor responsibilities must be confirmed per activity before this notice can be approved. Marketing requires a separate assessment and applicable opt-out or consent mechanism.</p>
    <h2>Sharing and hosting</h2><p>Relevant club administrators and authorised service suppliers may access information necessary for their roles. The platform uses hosted infrastructure; subprocessors, processing locations and any international transfer safeguards must be verified and disclosed in the final notice.</p>
    <h2>Retention and your rights</h2><p>Retention periods and backup deletion procedures are under review. UK data protection rights may include access, correction, erasure, restriction, portability and objection, subject to legal conditions. Contact <a href="mailto:support@rallora.app">support@rallora.app</a> to make a request. You may also complain to the UK Information Commissioner at <a href="https://ico.org.uk/">ico.org.uk</a>.</p>
    <p>This draft must not be represented as a complete UK GDPR privacy notice until the processing inventory, legal bases, suppliers and retention schedule have been verified.</p>
  </main>;
}
