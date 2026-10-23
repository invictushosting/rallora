"use client";
import { useState } from "react";
import Link from "next/link";
import RalloraFooter from "@/app/components/rallora-footer";
import RalloraLogo from "@/app/components/rallora-logo";
import { HELP_ARTICLES, HELP_CATEGORIES, HELP_REVIEWED, helpHref, searchHelp, type HelpCategory } from "@/lib/help";
import styles from "./help.module.css";
export default function HelpCentre({ club }: { club: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpCategory | undefined>();
  const articles = searchHelp(query, category);
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/" aria-label="Rallora home"><RalloraLogo width={185} /></Link><nav aria-label="Help navigation"><Link href={club ? `/clubs/${club}` : "/"}>{club ? "Back to club" : "Home"}</Link><Link href="/login">Sign in</Link></nav></header>
    <div className={styles.shell}>
      <section className={styles.hero}><span className={styles.eyebrow}>RALLORA HELP CENTRE</span><h1>A little help.<br /><em>Back to the court.</em></h1><p>From joining your first league to running the whole competition. Find the next step here.</p>
        <label className={styles.search}>What do you need help with?<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try booking a match, ratings or registration" maxLength={180} /></label>
        <span className={styles.reviewed}>{HELP_ARTICLES.length} practical guides · Reviewed {HELP_REVIEWED}</span>
      </section>
      <div className={styles.filters} role="group" aria-label="Filter guides by role"><button type="button" aria-pressed={!category} onClick={() => setCategory(undefined)}>All guides</button>{HELP_CATEGORIES.map(c => <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.title}</button>)}</div>
      <p className={styles.resultCount} role="status">{articles.length} guide{articles.length === 1 ? "" : "s"}{query.trim() ? ` matching “${query}”` : category ? ` for ${HELP_CATEGORIES.find(c => c.id === category)?.title.toLowerCase()}` : " to get you moving"}</p>
      {articles.length ? <div className={styles.grid}>{articles.map(a => <Link className={styles.card} key={a.slug} href={helpHref(a.slug, club)}><span>{HELP_CATEGORIES.find(c => c.id === a.category)?.title}</span><h2>{a.title}</h2><p>{a.summary}</p><strong>Read guide</strong></Link>)}</div> : <section className={styles.empty}><h2>No matching guide yet</h2><p>Try a shorter search such as “booking” or “captain”, or browse all guides.</p><button type="button" onClick={() => { setQuery(""); setCategory(undefined); }}>Show all guides</button></section>}
      <section className={styles.support}><div><span className={styles.eyebrow}>STILL STUCK?</span><h2>We’ll help you find the next step.</h2><p>Your club organiser handles entries, pairing changes and result disputes. For a technical problem, email Rallora with your club name and what happened.</p></div><a href="mailto:support@rallora.app">Contact Rallora support</a></section>
      <RalloraFooter club={club} />
    </div>
  </main>;
}
