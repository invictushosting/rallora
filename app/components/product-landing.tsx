import Link from "next/link";
import RalloraLogo from "@/app/components/rallora-logo";
import styles from "./product.module.css";

export type ProductKey = "leagues" | "social" | "interclub";
const PRODUCTS: Record<ProductKey, {
  name: string; label: string; headline: string; intro: string; status: string;
  features: { title: string; text: string }[];
  primaryLabel: string; primaryHref: string;
}> = {
  leagues: {
    name: "Rallora Leagues", label: "01 / LEAGUE MANAGEMENT",
    headline: "Your club. Your competition. Every result.",
    intro: "A home for padel seasons, divisions, fixtures, standings, cups and the people who bring them to life.",
    status: "Club league hubs available",
    features: [
      { title: "Seasons & divisions", text: "Keep each competition organised inside the club it belongs to." },
      { title: "Fixtures & results", text: "Give players a clear place to see their next match and confirmed scores." },
      { title: "Tables & cup places", text: "Standings and club-defined qualification in one view." },
      { title: "Club identity", text: "Every club retains its own colours, sponsors and league community." },
      { title: "Entry fees & prizes", text: "Plan free or paid league entry, sponsor contributions and cash or physical prizes. Checkout is not yet enabled." },
    ],
    primaryLabel: "Explore clubs", primaryHref: "/#clubs",
  },
  social: {
    name: "Rallora Social", label: "02 / SOCIAL & COMMUNICATIONS",
    headline: "Create once. Share everywhere.",
    intro: "Turn club news and confirmed league results into share-ready updates for the channels your players use.",
    status: "Manual sharing studio in development",
    features: [
      { title: "One content studio", text: "Write club news or build a post using a real, confirmed league result." },
      { title: "Platform-specific previews", text: "Prepare clear Facebook, Instagram, WhatsApp, email and website versions." },
      { title: "Branded graphics", text: "Download a ready-made results card with the club’s name and colours." },
      { title: "Connected publishing", text: "Account connections, approved WhatsApp messaging and scheduling are planned after permissions and consent checks." },
    ],
    primaryLabel: "Explore Social", primaryHref: "/#clubs",
  },
  interclub: {
    name: "Rallora Interclub", label: "03 / CONNECTED COMPETITIONS",
    headline: "Champions meet champions.",
    intro: "A future competition layer connecting clubs through invitations, regional challenges and shared events.",
    status: "Future product · preview",
    features: [
      { title: "Club invitations", text: "Two organisers agree to compete, with clear responsibilities and acceptance." },
      { title: "Champions vs champions", text: "Nominate eligible pairs without treating every club division as an identical standard." },
      { title: "Shared event hub", text: "One fixture, two clubs, an agreed result and a competition-specific table." },
      { title: "Built-in promotion", text: "Bring Rallora Social into match announcements, results and champions graphics." },
    ],
    primaryLabel: "See current leagues", primaryHref: "/#clubs",
  },
};

export default function ProductLanding({ product }: { product: ProductKey }) {
  const item = PRODUCTS[product];
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" aria-label="Rallora home"><RalloraLogo width={205} /></Link>
      <nav aria-label="Rallora products">
        <Link href="/products">All products</Link>
        <Link href="/leagues" aria-current={product === "leagues" ? "page" : undefined}>Leagues</Link>
        <Link href="/social" aria-current={product === "social" ? "page" : undefined}>Social</Link>
        <Link href="/interclub" aria-current={product === "interclub" ? "page" : undefined}>Interclub</Link>
      </nav>
    </header>
    <div className={styles.shell}>
      <section className={styles.hero}>
        <span className={styles.kicker}>{item.label}</span>
        <h1>{item.headline}</h1>
        <p>{item.intro}</p>
        <span className={styles.status}>{item.status}</span>
        <div className={styles.actions}>
          <Link className={styles.cta} href={item.primaryHref}>{item.primaryLabel} ↗</Link>
          {product === "leagues" && <Link className={styles.demo} href="/clubs/new-padel-club">
            Try the live demo →</Link>}
          <Link className={styles.outline} href="/register-club">Register your club →</Link>
        </div>
      </section>
      <section className={styles.features} aria-labelledby="product-features">
        <div className={styles.heading}><span className={styles.kicker}>MADE FOR PADEL CLUBS</span>
          <h2 id="product-features">Everything connected.</h2></div>
        <div className={styles.grid}>{item.features.map((feature, index) =>
          <article className={styles.card} key={feature.title}>
            <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
            <h3>{feature.title}</h3><p>{feature.text}</p>
          </article>)}</div>
      </section>
      {product === "interclub" && <aside className={styles.callout}>
        <strong>Future product, not a live competition.</strong>
        <p>Interclub invitations and results are not active yet. Existing club
          league scores will remain separate from future Interclub events.</p>
      </aside>}
      {product === "social" && <aside className={styles.callout}>
        <strong>Social Studio: first release</strong>
        <p>Approved club organisers will be able to prepare and manually share
          posts. Automated Facebook, Instagram, WhatsApp Business and email
          delivery is not enabled until the account and consent work is complete.</p>
      </aside>}
      <footer className={styles.footer}>© Rallora · One club platform, connected products.</footer>
    </div>
  </main>;
}
