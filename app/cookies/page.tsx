import Link from "next/link";
export const metadata = { title: "Cookies | Rallora" };
export default function CookiesPage() { return <main style={{maxWidth:760,margin:"0 auto",padding:"48px 24px",lineHeight:1.7}}>
  <Link href="/">← Rallora</Link><h1>Cookies and similar technologies</h1>
  <p><strong>Draft pending cookie and tracking audit.</strong></p>
  <p>Rallora may use storage necessary to keep users signed in and protect accounts. We are auditing analytics, embedded services and other optional technologies. Non-essential cookies or similar technologies requiring consent must not be used until appropriate consent controls are in place.</p>
  <p>The final notice will identify the technologies, providers, purposes, durations and consent choices after the audit. Email <a href="mailto:support@rallora.app">support@rallora.app</a> with questions. See also our <Link href="/privacy">privacy information</Link>.</p>
</main>; }
