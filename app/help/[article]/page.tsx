import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RalloraFooter from "@/app/components/rallora-footer";
import RalloraLogo from "@/app/components/rallora-logo";
import { HELP_ARTICLES, HELP_CATEGORIES, HELP_REVIEWED, helpHref, safeClubSlug } from "@/lib/help";
import styles from "../help.module.css";
type Props = { params: Promise<{ article: string }>; searchParams: Promise<{ club?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { article } = await params;
  const guide = HELP_ARTICLES.find(a => a.slug === article);
  return { title: guide ? `${guide.title} | Rallora Help` : "Guide not found | Rallora", description: guide?.summary };
}
export default async function ArticlePage({ params, searchParams }: Props) {
  const [{ article }, { club: rawClub }] = await Promise.all([params, searchParams]);
  const guide = HELP_ARTICLES.find(a => a.slug === article);
  if (!guide) notFound();
  const club = safeClubSlug(rawClub);
  const base = club ? `/clubs/${club}` : "";
  const related = guide.related.map(slug => HELP_ARTICLES.find(a => a.slug === slug)).filter(a => a !== undefined);
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/" aria-label="Rallora home"><RalloraLogo width={185} /></Link><nav aria-label="Help navigation"><Link href={helpHref("", club)}>All guides</Link><Link href={base || "/login"}>{base ? "Back to club" : "Sign in"}</Link></nav></header>
    <div className={styles.shell}>
      <div className={styles.breadcrumb}><Link href={helpHref("", club)}>Help centre</Link><span>/</span><span>{HELP_CATEGORIES.find(c => c.id === guide.category)?.title}</span></div>
      <header className={styles.articleHero}><span className={styles.eyebrow}>{HELP_CATEGORIES.find(c => c.id === guide.category)?.title} GUIDE</span><h1>{guide.title}</h1><p>{guide.summary}</p><span className={styles.reviewed}>Reviewed {HELP_REVIEWED}</span></header>
      <div className={styles.articleLayout}>
        <aside className={styles.contents}><nav aria-label="On this page"><strong>In this guide</strong>{guide.sections.map(s => <a href={`#${s.id}`} key={s.id}>{s.title}</a>)}</nav>{base && <nav aria-label="Club shortcuts"><strong>Your club</strong><Link href={base}>League centre</Link><Link href={`${base}/captain`}>Captain centre</Link>{guide.category === "clubs" || guide.category === "playtomic" ? <Link href={`${base}/admin`}>Club administration</Link> : <Link href={`${base}/register`}>Registration</Link>}</nav>}</aside>
        <article className={styles.article}>{guide.sections.map((s, index) => <section id={s.id} key={s.id}><span className={styles.stepNumber}>STEP {String(index + 1).padStart(2, "0")}</span><h2>{s.title}</h2><ol>{s.steps.map(step => <li key={step}>{step}</li>)}</ol>{s.note && <aside className={styles.note}><strong>Good to know</strong><p>{s.note}</p></aside>}</section>)}
          {guide.slug === "connect-playtomic" && <div className={styles.actions}><a href="https://manager.playtomic.io/" target="_blank" rel="noopener noreferrer">Open Playtomic Manager</a>{base && <Link href={`${base}/admin/integrations`}>Open club integrations</Link>}</div>}
          {guide.slug === "club-reminders" && base && <div className={styles.actions}><Link href={`${base}/admin/reminders`}>Open reminder settings</Link></div>}
          <div className={styles.articleEnd}><h2>Need a hand with your club?</h2><p>Contact the organiser for entry decisions, pairings and match disputes. For a technical problem, email <a href="mailto:support@rallora.app">support@rallora.app</a>. Include your club name and the issue, keeping passwords and API secrets private.</p></div>
        </article>
      </div>
      <section className={styles.related}><span className={styles.eyebrow}>KEEP GOING</span><h2>Related guides</h2><div className={styles.grid}>{related.map(a => <Link href={helpHref(a.slug, club)} key={a.slug} className={styles.card}><h3>{a.title}</h3><p>{a.summary}</p><strong>Read guide</strong></Link>)}</div></section>
      <RalloraFooter club={club} />
    </div>
  </main>;
}
