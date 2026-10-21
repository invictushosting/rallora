import Link from "next/link";
import RalloraLogo from "./rallora-logo";
import { sponsorshipEmail, sponsorWebsite } from "@/lib/sponsors";
import styles from "./club-footer.module.css";
export default function ClubFooter({ name, slug, email, website, text }: { name: string; slug: string; email?: string | null; website?: string | null; text?: string | null }) {
  const contact = sponsorshipEmail(email, name), site = sponsorWebsite(website ?? null);
  const base = `/clubs/${encodeURIComponent(slug)}`;
  return <footer className={styles.footer}>
    <div className={styles.top}><div className={styles.identity}><strong>{name}</strong><p>{text || "Your club. Your league. Your next match."}</p>
      <div className={styles.contact}>{contact && <a href={`mailto:${email?.trim()}`}>Contact the club</a>}{site && <a href={site} target="_blank" rel="noopener noreferrer">Club website</a>}</div></div>
      <nav aria-label="Club footer"><Link href={base}>League centre</Link><Link href={`${base}/events`}>Club events</Link><Link href={`${base}/captain`}>Captain login</Link></nav></div>
    <div className={styles.bottom}><span>Leagues at {name}</span><Link href="/" aria-label="Powered by Rallora"><span>Powered by</span><RalloraLogo variant="dark" width={116} /></Link></div>
  </footer>;
}
