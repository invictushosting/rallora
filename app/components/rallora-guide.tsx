"use client";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { HELP_ARTICLES, helpAnswerSection, helpHref, safeClubSlug, searchHelp, suggestedHelp } from "@/lib/help";
import styles from "./rallora-guide.module.css";
type Item = { question: string; articles: string[] };
export default function RalloraGuide() {
  const path = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<Item[]>([]);
  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const launchRef = useRef<HTMLButtonElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const slug = safeClubSlug(/^\/clubs\/([^/]+)/.exec(path)?.[1] ?? searchParams.get("club"));
  const suggestions = suggestedHelp(path).map(id => HELP_ARTICLES.find(a => a.slug === id)).filter(a => a !== undefined);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (open && history.length) bottomRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [history, open]);
  function close() { setOpen(false); launchRef.current?.focus(); }
  function ask(question: string) {
    const text = question.trim().slice(0, 300);
    if (!text) return;
    setHistory(h => [...h.slice(-5), { question: text, articles: searchHelp(text).slice(0, 3).map(a => a.slug) }]);
    setInput("");
  }
  // Keep the maintenance screen free of overlays.
  if (!path || path.startsWith("/maintenance")) return null;
  return <div className={styles.dock}>
    {open && <section className={styles.panel} id={panelId} aria-label="Rallora help assistant" onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
      <header className={styles.heading}><div><strong>Rallora Help</strong><span>Guides for your next step</span></div><button type="button" onClick={close} aria-label="Close help">×</button></header>
      <div className={styles.thread} role="log" aria-live="polite" aria-relevant="additions">
        <div className={styles.guide}><p>Find step-by-step help for registration, bookings, results and club setup. Choose a topic or type a question.</p><Link href={helpHref("", slug)} onClick={close}>Browse all help guides</Link></div>
        {!history.length && <div className={styles.suggestions} role="group" aria-label="Suggested help for this page">{suggestions.map(a => <button type="button" key={a.slug} onClick={() => ask(a.title)}>{a.title}</button>)}</div>}
        {history.map((item, index) => {
          const matches = item.articles.map(id => HELP_ARTICLES.find(a => a.slug === id)).filter(a => a !== undefined);
          const first = matches[0];
          const section = first ? helpAnswerSection(first, item.question) : undefined;
          return <div className={styles.exchange} key={index}>
            <div className={styles.you}><p>{item.question}</p></div>
            <div className={styles.guide}>{first ? <><strong>{first.title}</strong><p>{first.summary}</p><ol>{section!.steps.map(step => <li key={step}>{step}</li>)}</ol>{section!.note && <p className={styles.note}>{section!.note}</p>}<Link href={helpHref(first.slug, slug)} onClick={close}>Read the full guide</Link>{matches.length > 1 && <div className={styles.also}><span>Also useful</span>{matches.slice(1).map(a => <Link key={a.slug} href={helpHref(a.slug, slug)} onClick={close}>{a.title}</Link>)}</div>}</> : <><strong>Let’s find the right help.</strong><p>I couldn’t find a clear match. Try “record a booking”, “registration status” or “connect Playtomic”. Your organiser can help with your own entry or result.</p><Link href={helpHref("", slug)} onClick={close}>Browse all guides</Link><a href="mailto:support@rallora.app">Contact Rallora support</a></>}</div>
          </div>;
        })}
        <div ref={bottomRef} />
      </div>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); ask(input); }}><label htmlFor={`${panelId}-question`}>What do you need help with?</label><div><input id={`${panelId}-question`} ref={inputRef} value={input} maxLength={300} onChange={e => setInput(e.target.value)} placeholder="e.g. How do I submit a result?" /><button type="submit" disabled={!input.trim()}>Find help</button></div></form>
      <div className={styles.utility}><Link href={helpHref("", slug)} onClick={close}>All guides</Link>{history.length > 0 && <button type="button" onClick={() => { setHistory([]); inputRef.current?.focus(); }}>Clear questions</button>}</div>
      <p className={styles.privacy}>Guide search only. No access to your account or live bookings. Questions stay on this page. Keep passwords and API secrets private.</p>
    </section>}
    <button ref={launchRef} className={styles.launch} type="button" onClick={() => open ? close() : setOpen(true)} aria-expanded={open} aria-controls={open ? panelId : undefined}><span aria-hidden="true">?</span>{open ? "Close help" : "Help & guides"}</button>
  </div>;
}
