import Link from "next/link";
import RalloraLogo from "@/app/components/rallora-logo";
import styles from "@/app/components/product.module.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Rallora Platform | Leagues, Social, Interclub",
  description: "Three connected products for padel clubs and players.",
};

const family = [
  { path: "/leagues", label: "01 / MANAGE", title: "Rallora Leagues",
    summary: "Seasons, fixtures, results, standings and cups under your club identity.",
    status: "Club league hubs available", action: "Explore Leagues" },
  { path: "/social", label: "02 / CONNECT", title: "Rallora Social",
    summary: "Club news, branded league graphics and channel-aware communications.",
    status: "Manual sharing studio in development", action: "Explore Social" },
  { path: "/interclub", label: "03 / COMPETE", title: "Rallora Interclub",
    summary: "Invitations, regional events and champions versus champions.",
    status: "Future product", action: "Discover Interclub" },
];

export default function ProductsPage() {
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" aria-label="Rallora home"><RalloraLogo width={205} /></Link>
      <nav aria-label="Navigation"><Link href="/">Home</Link><Link href="/#clubs">Find a club</Link>
        <Link href="/platform">Club administration</Link></nav>
    </header>
    <div className={styles.shell}>
      <section className={styles.hero}>
        <span className={styles.kicker}>ONE BRAND. CONNECTED PRODUCTS.</span>
        <h1>The home of connected padel.</h1>
        <p>League management, club communications and future competitions between clubs.
          One Rallora identity, one club dashboard, room to grow.</p>
        <div className={styles.actions}>
          <Link className={styles.cta} href="/#clubs">Find your club ↗</Link>
          <Link className={styles.outline} href="/leagues">Explore the platform →</Link>
        </div>
      </section>
      <section className={styles.features}>
        <div className={styles.heading}><span className={styles.kicker}>THE PRODUCT FAMILY</span>
          <h2>Built to work better together.</h2></div>
        <div className={styles.grid} style={{gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,280px),1fr))"}}>
          {family.map(item=><article className={styles.card} key={item.path}>
            <span className={styles.number}>{item.label}</span><h3>{item.title}</h3>
            <p>{item.summary}</p><p><strong>{item.status}</strong></p>
            <Link href={item.path} style={{color:"#006aaf",fontWeight:850,textDecoration:"none"}}>
              {item.action} ↗</Link>
          </article>)}
        </div>
      </section>
      <aside className={styles.callout}><strong>Rallora AI: a layer across every product.</strong>
        <p>The planned assistant will help players find published match information,
          help organisers prepare social content, and eventually guide Interclub events.
          Live AI chat is not switched on yet.</p></aside>
      <footer className={styles.footer}>Rallora · Padel, connected.</footer>
    </div>
  </main>;
}
