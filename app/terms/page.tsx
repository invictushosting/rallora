import Link from "next/link";
export const metadata = { title: "Player terms | Rallora" };
export default function TermsPage() { return <main style={{maxWidth:760,margin:"0 auto",padding:"48px 24px",lineHeight:1.7}}>
  <Link href="/">← Rallora</Link><h1>Rallora player terms</h1>
  <p><strong>Draft for legal review — not approved for publication.</strong></p>
  <p>Rallora is a platform provided by Protego Solutions Ltd (company number 12924277). Creating an account does not register you for a competition or guarantee a place in a league.</p>
  <h2>Accounts</h2><p>Provide accurate registration information, keep login credentials private, and notify support if you suspect unauthorised use. Do not impersonate others or misuse the service.</p>
  <h2>Club competitions</h2><p>Clubs set and administer their own league rules, entry criteria, scheduling and match decisions unless Rallora expressly states otherwise. Club-specific rules will be presented by the club where applicable.</p>
  <h2>Fair use and safety</h2><p>Do not harass players, submit fraudulent scores, access another person&apos;s account, scrape personal information or use the platform unlawfully. We may restrict access to investigate abuse, subject to applicable legal obligations.</p>
  <h2>Privacy and support</h2><p>Read the <Link href="/privacy">privacy information</Link> for details of personal data use. Contact <a href="mailto:support@rallora.app">support@rallora.app</a> with account or service questions.</p>
  <p>Consumer cancellation rights, age limits, moderation, availability, liability, complaints and governing-law clauses require legal review before terms become binding.</p>
</main>; }
