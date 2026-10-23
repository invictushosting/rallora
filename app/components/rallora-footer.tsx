import Link from "next/link";
import RalloraLogo from "./rallora-logo";
import { helpHref, safeClubSlug } from "@/lib/help";
import styles from "./rallora-footer.module.css";

/** Shared Rallora footer, matching the approved navy home-page branding. */
export default function RalloraFooter({ club = "", note }: { club?: string; note?: string }) {
  const slug = safeClubSlug(club);
  return <footer className={styles.footer}>
    <div className={styles.inner}>
      <Link className={styles.brand} href="/" aria-label="Rallora home"><RalloraLogo variant="dark" width={245} /></Link>
      <div className={styles.content}>
        <strong className={styles.tagline}>PADEL LEAGUES · SIMPLIFIED</strong>
        <nav aria-label="Footer navigation">
          <Link href={helpHref("", slug)}>Help &amp; guides</Link>
          {slug && <><Link href={`/clubs/${slug}`}>League centre</Link><Link href={`/clubs/${slug}/admin`}>Club administration</Link></>}
          <a href="mailto:support@rallora.app">Contact support</a>
        </nav>
        <span className={styles.copyright}>© {new Date().getFullYear()} Rallora · A Protego Solutions product.</span>
      </div>
      {note && <p className={styles.note}>{note}</p>}
    </div>
  </footer>;
}
