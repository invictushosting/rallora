import Link from "next/link";
export const metadata = { title: "Cookies | Rallora" };
export default function CookiesPage() { return <main style={{maxWidth:760,margin:"0 auto",padding:"48px 24px",lineHeight:1.7}}>
  <Link href="/">← Rallora</Link><h1>Cookies and similar technologies</h1>
  <p><strong>Draft pending cookie and tracking audit.</strong></p>
  <p>Rallora uses browser storage to support requested account and club features. The source inventory below still needs confirmation against the deployed, signed-in service before this notice is approved.</p>
  <ul>
    <li>Authentication cookies support sign-in, recovery and sessions. The installed authentication library has a default cookie maximum age of 400 days; access-token validity and server session lifetime are separate and need verification.</li>
    <li>Registration drafts use session storage to keep player details while you complete entry or verify your email. The saved draft does not include your password and is removed after successful entry; browser tab/session behaviour also controls its lifetime.</li>
    <li>Social Studio can save a club and user-specific post draft on the device. There is no automatic expiry in the current source; use Clear draft and clear site data on shared devices as appropriate.</li>
    <li>A temporary setup-navigation flag is removed when consumed or when its browser session ends.</li>
  </ul>
  <p>The source review found no explicit third-party analytics script or tracking pixel in the searched application code. Hosting-injected technologies and actual cookie names, flags and expiry still need deployed-browser checks. Each purpose must be assessed under the current PECR rules; any technology requiring consent must wait until an appropriate choice is made.</p>
  <p>The final notice will identify the technologies, providers, purposes, durations and consent choices after the audit. Email <a href="mailto:support@rallora.app">support@rallora.app</a> with questions. See also our <Link href="/privacy">privacy information</Link>.</p>
</main>; }
