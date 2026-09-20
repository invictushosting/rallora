"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import styles from "./rallora-guide.module.css";

type Item = { who: "guide" | "you"; text: string; href?: string; label?: string };
const INITIAL: Item[] = [
  { who: "guide", text: "Hi! I’m the Rallora Guide. I can point you to leagues, fixtures, Social Studio and club administration. Full AI answers from live league data are coming later." },
];

function replyTo(question: string, slug: string): Item {
  const value = question.toLowerCase();
  const clubHome = slug ? `/clubs/${slug}` : "/#clubs";
  const admin = slug ? `/clubs/${slug}/admin` : "/platform";
  const social = slug ? `/clubs/${slug}/social` : "/social";
  if (/social|facebook|instagram|whatsapp|post|news|graphic|share|email/.test(value)) {
    return { who: "guide",
      text: slug
        ? "Rallora Social helps your club prepare news, confirmed result cards and channel-specific captions. Automatic publishing isn't connected yet."
        : "Rallora Social is our club communications product. Clubs prepare news and shareable posts in their own studio.",
      href: social, label: slug ? "Open this club’s Social Studio" : "Explore Rallora Social" };
  }
  if (/interclub|champion|challenge|tournament|regional/.test(value)) {
    return { who: "guide",
      text: "Rallora Interclub is a future product for club-to-club invitations and champions versus champions. No cross-club events are live yet.",
      href: "/interclub", label: "See Interclub plans" };
  }
  if (/result|fixture|score|standings|table|division|match|team|season|cup/.test(value)) {
    return { who: "guide",
      text: "Fixtures, confirmed results and tables are shown in each published club league hub. I won't guess individual scores or dates.",
      href: clubHome, label: slug ? "Open this club’s league hub" : "Find your club" };
  }
  if (/admin|signin|sign in|login|organis|edit|captain|account/.test(value)) {
    return { who: "guide",
      text: "Club dashboards require a verified organiser account. Your club administrator can help with permissions.",
      href: admin, label: slug ? "Club administration" : "Platform sign in" };
  }
  if (/club|register|join|where|contact|help|support/.test(value)) {
    return { who: "guide",
      text: "Start from your club’s own hub for its published announcements and competition details. If information is missing, contact the organiser directly.",
      href: clubHome, label: slug ? "View this club" : "Find a club" };
  }
  return { who: "guide",
    text: "I can help you find your club, see league tables and fixtures, prepare club social posts or discover Interclub. For a specific score or date, open the published club hub.",
    href: clubHome, label: slug ? "Open this club" : "Explore clubs" };
}

/**
 * Read-only guided chat with no model calls, server requests or stored messages.
 * Do not misrepresent this navigation guide as a connected generative AI service.
 */
export default function RalloraGuide() {
  const [path, setPath] = useState("");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<Item[]>(INITIAL);
  const bottom = useRef<HTMLDivElement>(null);
  const panelId = useId();
  useEffect(() => {
    setPath(window.location.pathname);
  }, []);
  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [history, open]);
  // Preserve the original legacy GSM single-page experience without new overlays.
  if (!path || path === "/clubs/gsm-padel" || path === "/clubs/gsm-padel/") return null;
  const slug = /^\/clubs\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/|$)/.exec(path)?.[1] ?? "";
  function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim().slice(0, 300);
    if (!text) return;
    setHistory(h => [...h.slice(-12), { who: "you", text }, replyTo(text, slug)]);
    setInput("");
  }
  return <div className={styles.dock}>
    {open && <section className={styles.panel} id={panelId} aria-label="Rallora Guide">
      <header className={styles.heading}>
        <div><strong>Rallora Guide</strong><span>Early access · Guided help</span></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close guide">×</button>
      </header>
      <div className={styles.thread} role="log" aria-live="polite" aria-relevant="additions">
        {history.map((item, index) =>
          <div className={item.who === "you" ? styles.you : styles.guide} key={index}>
            <p>{item.text}</p>
            {item.href && <Link href={item.href} onClick={() => setOpen(false)}>
              {item.label} →</Link>}
          </div>)}
        <div ref={bottom} />
      </div>
      <form className={styles.form} onSubmit={send}>
        <label htmlFor="rallora-guide-question">How can I help?</label>
        <div><input id="rallora-guide-question" value={input} maxLength={300}
          onChange={event => setInput(event.target.value)}
          placeholder="Find fixtures, Social, admin…" />
        <button type="submit" disabled={!input.trim()}>Send</button></div>
      </form>
      <p className={styles.privacy}>Guided navigation, not live AI or support chat.
        No messages are saved or sent to a server.</p>
    </section>}
    <button className={styles.launch} type="button" onClick={() => setOpen(value => !value)}
      aria-expanded={open} aria-controls={panelId}>
      <span aria-hidden="true">✦</span> {open ? "Close guide" : "Need a hand?"}
    </button>
  </div>;
}
