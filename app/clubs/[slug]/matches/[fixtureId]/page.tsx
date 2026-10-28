"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import BackLink from "@/app/components/back-link";
import { createClient } from "@/lib/supabase";
import { canRespondToProposal, proposalIsCurrent, type FixtureConversation, type FixtureMessage } from "@/lib/fixture-messaging";
import FixtureBooking, { type FixtureArrangement } from "../../captain/fixture-booking";
import styles from "./match.module.css";

const FIELDS = "id,sequence,fixture_id,sender_user_id,sender_team_id,sender_name,kind,body,starts_at,ends_at,court,proposal_status,home_roster_version,away_roster_version,created_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default function MatchConversationPage() {
  const { slug, fixtureId } = useParams<{ slug: string; fixtureId: string }>();
  const db = useMemo(() => createClient(), []);
  const [context, setContext] = useState<FixtureConversation | null>(null);
  const [messages, setMessages] = useState<FixtureMessage[]>([]);
  const [proposals, setProposals] = useState<FixtureMessage[]>([]);
  const [arrangement, setArrangement] = useState<FixtureArrangement>();
  const [viewer, setViewer] = useState("");
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [body, setBody] = useState(""), [mode, setMode] = useState<"message" | "proposal" | "help">("message");
  const [older, setOlder] = useState(false);
  const version = useRef(0), sending = useRef(false);
  const retry = useRef<{ signature: string; id: string } | null>(null);

  const load = useCallback(async () => {
    const current = ++version.current;
    try {
      if (!UUID.test(fixtureId)) throw new Error("Match conversation unavailable.");
      const auth = await db.auth.getUser();
      if (auth.error || !auth.data.user) throw new Error("Sign in with your captain or club organiser account to open this match.");
      const reply = await db.rpc("rallora_fixture_conversation", { p_fixture_id: fixtureId });
      if (reply.error || !reply.data || reply.data.slug !== slug) throw new Error("This match is unavailable or your account does not have access.");
      const c = reply.data as FixtureConversation;
      const [history, active, booking] = await Promise.all([
        db.from("rallora_fixture_messages").select(FIELDS).eq("fixture_id", fixtureId).order("sequence", { ascending: false }).limit(100),
        db.from("rallora_fixture_messages").select(FIELDS).eq("fixture_id", fixtureId).in("proposal_status", ["pending", "accepted"]).order("sequence", { ascending: false }),
        db.from("rallora_fixture_arrangements").select("fixture_id,starts_at,ends_at,court").eq("fixture_id", fixtureId).maybeSingle(),
      ]);
      if (history.error || active.error || booking.error) throw new Error("Could not load this conversation. Please refresh and try again.");
      if (current !== version.current) return;
      const rows = (history.data ?? []) as FixtureMessage[];
      setContext(c); setViewer(auth.data.user.id);
      setMessages(previous => [...previous.filter(m => rows.length && m.sequence < rows[rows.length - 1].sequence), ...rows.toReversed()]);
      setProposals((active.data ?? []) as FixtureMessage[]); setArrangement(booking.data ?? undefined);
      setOlder(rows.length === 100); setError("");
      if (rows[0] && document.visibilityState === "visible") {
        const read = await db.rpc("rallora_read_fixture_messages", { p_fixture_id: fixtureId, p_sequence: rows[0].sequence });
        if (read.error && current === version.current) setNotice("Messages loaded, but the unread indicator could not be updated.");
      }
    } catch (e) {
      if (current === version.current) { setError(e instanceof Error ? e.message : "Could not load messages."); setContext(null); setMessages([]); setProposals([]); }
    } finally { if (current === version.current) setLoading(false); }
  }, [db, fixtureId, slug]);

  useEffect(() => {
    setLoading(true); setContext(null); setMessages([]); setBody(""); setMode("message"); retry.current = null;
    void load();
    const refresh = () => { if (document.visibilityState === "visible" && !sending.current) void load(); };
    const timer = setInterval(refresh, 10000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    const listener = db.auth.onAuthStateChange(() => { version.current++; setContext(null); setMessages([]); setLoading(true); setBody(""); retry.current = null; queueMicrotask(() => void load()); });
    const invalidate = () => { version.current++; };
    return () => { invalidate(); clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); listener.data.subscription.unsubscribe(); };
  }, [db, load]);

  async function send(event?: FormEvent<HTMLFormElement>, kind = mode) {
    event?.preventDefault();
    if (sending.current || !context?.writable) return;
    if (kind !== "proposal" && !body.trim()) { setNotice("Enter a message first."); return; }
    const form = event ? new FormData(event.currentTarget) : null;
    const startValue = form?.get("start");
    const start = kind === "proposal" ? new Date(String(startValue ?? "")) : null;
    if (start && !Number.isFinite(start.getTime())) { setNotice("Choose a valid proposed time."); return; }
    const duration = Number(form?.get("duration") ?? 90);
    const payload = { p_fixture_id: fixtureId, p_kind: kind, p_body: body.trim(),
      p_starts_at: start?.toISOString() ?? null,
      p_ends_at: start ? new Date(start.getTime() + duration * 60000).toISOString() : null,
      p_court: kind === "proposal" ? String(form?.get("court") ?? "").trim() : null };
    const signature = JSON.stringify(payload);
    if (retry.current?.signature !== signature) retry.current = { signature, id: crypto.randomUUID() };
    sending.current = true; setBusy(true); setNotice("");
    try {
      const result = await db.rpc("rallora_post_fixture_message", { ...payload, p_message_id: retry.current.id });
      if (result.error) throw result.error;
      retry.current = null; setBody(""); setMode("message");
      setNotice(kind === "help" ? "Help request added to the organiser’s match inbox." : "Sent.");
      await load();
    } catch (e) { setNotice(e && typeof e === "object" && "message" in e ? String(e.message) : "Could not send. Your message is still here; try again."); }
    finally { sending.current = false; setBusy(false); }
  }

  async function respond(message: FixtureMessage, decision: "accepted" | "declined") {
    if (sending.current || !context || !canRespondToProposal(message, context, viewer)) return;
    sending.current = true; setBusy(true); setNotice("");
    try {
      const result = await db.rpc("rallora_respond_fixture_proposal", { p_message_id: message.id, p_decision: decision });
      if (result.error) throw result.error;
      setNotice(decision === "accepted" ? "Time agreed. Book the court separately, then record the booking below." : "Time declined. You can suggest another time.");
      await load();
    } catch (e) { setNotice(e && typeof e === "object" && "message" in e ? String(e.message) : "Could not respond. Refresh and try again."); }
    finally { sending.current = false; setBusy(false); }
  }

  async function resolveHelp() {
    if (sending.current || !context?.manager) return;
    sending.current = true; setBusy(true);
    try {
      const result = await db.rpc("rallora_post_fixture_message", { p_fixture_id: fixtureId, p_message_id: crypto.randomUUID(), p_kind: "resolved", p_body: "The organiser marked this help request as resolved." });
      if (result.error) throw result.error;
      setNotice("Help request resolved."); await load();
    } catch (e) { setNotice(e && typeof e === "object" && "message" in e ? String(e.message) : "Could not resolve the request."); }
    finally { sending.current = false; setBusy(false); }
  }

  async function loadOlder() {
    if (sending.current || !messages[0]) return;
    sending.current = true; setBusy(true);
    try {
      const result = await db.from("rallora_fixture_messages").select(FIELDS).eq("fixture_id", fixtureId).lt("sequence", messages[0].sequence).order("sequence", { ascending: false }).limit(100);
      if (result.error) throw result.error;
      setMessages(current => [...((result.data ?? []) as FixtureMessage[]).toReversed(), ...current]);
      setOlder(result.data?.length === 100);
    } catch { setNotice("Could not load earlier messages. Please try again."); }
    finally { sending.current = false; setBusy(false); }
  }

  const agreed = proposals.find(p => p.proposal_status === "accepted" && context && p.home_roster_version === context.home_roster_version && p.away_roster_version === context.away_roster_version);
  const date = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: context?.timezone ?? "Europe/London", dateStyle: "medium", timeStyle: "short" });
  return <main className={styles.page}><div className={styles.shell}>
    <nav><BackLink href={context?.manager ? `/clubs/${slug}/admin/matches` : `/clubs/${slug}/captain`}>{context?.manager ? "Back to match inbox" : "Back to captain centre"}</BackLink><Link href="/notifications">Your notifications</Link></nav>
    {loading ? <p role="status">Loading match conversation…</p> : error ? <section className={styles.panel}><h1>Match conversation</h1><p role="alert">{error}</p><button onClick={() => void load()}>Try again</button><Link href="/login">Sign in</Link></section> : context && <>
      <header className={styles.hero}><span>MATCH CENTRE · {context.club}</span><h1>{context.home} <em>vs</em> {context.away}</h1><p>{context.league} · {context.division} · Play by {new Date(context.play_by + "T12:00:00").toLocaleDateString("en-GB")}</p><p>Private to this fixture’s current captains and club organisers.</p></header>
      {!context.writable && <p className={styles.banner}>This fixture is read-only. Messages remain available for reference.</p>}
      {context.help_requested && <aside className={styles.banner}><strong>Organiser help requested</strong><p>This match is flagged in the club’s match inbox.</p>{context.manager && context.writable && <button disabled={busy} onClick={() => void resolveHelp()}>Mark help request resolved</button>}</aside>}
      {!context.email_enabled && <p className={styles.banner}>Email alerts for match conversations are currently paused by the club. Check this match for replies.{context.manager && <> <Link href={`/clubs/${slug}/admin/reminders`}>Manage communication settings</Link></>}</p>}
      <div className={styles.layout}><section className={styles.panel} aria-labelledby="conversation-title"><div className={styles.sectionHead}><h2 id="conversation-title">Match conversation</h2><button disabled={busy} onClick={() => void load()}>Refresh</button></div><p className={styles.helper}>Messages refresh every 10 seconds while this page is open.</p>
        {older && <button disabled={busy} onClick={() => void loadOlder()}>Load earlier messages</button>}
        <ol className={styles.messages}>{messages.map(message => <li key={message.id} className={message.sender_user_id === viewer ? styles.own : ""}><div className={styles.messageHead}><strong>{message.sender_name}{message.sender_user_id === viewer ? " · You" : message.sender_team_id ? " · Captain" : " · Organiser"}</strong><time dateTime={message.created_at}>{date(message.created_at)}</time></div>
          {message.kind !== "message" && <span className={styles.tag}>{message.kind === "proposal" ? `Time proposal · ${message.proposal_status}` : message.kind === "help" ? "Organiser help requested" : message.kind === "resolved" ? "Help resolved" : `Time ${message.kind}`}</span>}
          {message.body && <p className={styles.body}>{message.body}</p>}
          {message.kind === "proposal" && message.starts_at && <><p><strong>{date(message.starts_at)}</strong>{message.ends_at && <> – {new Date(message.ends_at).toLocaleTimeString("en-GB", { timeZone: context.timezone, hour: "2-digit", minute: "2-digit" })}</>} · {context.timezone}{message.court && <> · {message.court}</>}</p><p className={styles.helper}>A proposed time does not reserve a court.</p>{message.proposal_status === "pending" && !proposalIsCurrent(message, context) && <p className={styles.helper}>This proposal is no longer current. Suggest a new time.</p>}{canRespondToProposal(message, context, viewer) && <div className={styles.actions}><button disabled={busy} onClick={() => void respond(message, "accepted")}>Accept time</button><button disabled={busy} onClick={() => void respond(message, "declined")}>Decline time</button></div>}{message.proposal_status === "pending" && message.sender_user_id === viewer && <p className={styles.helper}>Waiting for the opposing captain.</p>}</>}
        </li>)}</ol>{!messages.length && <p>No messages yet. Introduce yourself or suggest a time for this match.</p>}
        {context.writable && <form onSubmit={event => void send(event)} className={styles.composer}><label htmlFor="message-kind">Action</label><select id="message-kind" value={mode} disabled={busy} onChange={event => setMode(event.target.value as typeof mode)}><option value="message">Send a message</option>{context.viewer_team_id && <><option value="proposal">Propose a time</option><option value="help">Ask organiser for help</option></>}</select>
          {mode === "proposal" && <><label htmlFor="proposed-start">Proposed start (your device’s local time)<input id="proposed-start" name="start" type="datetime-local" required disabled={busy}/></label><label htmlFor="proposed-duration">Duration<select id="proposed-duration" name="duration" defaultValue="90" disabled={busy}><option value="60">60 minutes</option><option value="90">90 minutes</option><option value="120">120 minutes</option></select></label><label htmlFor="proposed-court">Court (optional)<input id="proposed-court" name="court" maxLength={120} disabled={busy}/></label><p className={styles.helper}>A new proposal replaces the previous pending proposal.</p></>}
          <label htmlFor="match-message">{mode === "help" ? "What do you need help with?" : mode === "proposal" ? "Message (optional)" : "Message"}<textarea id="match-message" value={body} onChange={event => setBody(event.target.value)} maxLength={2000} required={mode !== "proposal"} rows={3} disabled={busy}/></label><small>{body.length}/2000</small><button disabled={busy} type="submit">{busy ? "Working…" : mode === "proposal" ? "Send time proposal" : mode === "help" ? "Request organiser help" : "Send message"}</button>
        </form>}
      </section><aside><section className={styles.panel}><h2>Match arrangements</h2>{agreed?.starts_at ? <><span className={styles.tag}>TIME AGREED</span><p><strong>{date(agreed.starts_at)}</strong> · {context.timezone}</p>{agreed.court && <p>{agreed.court}</p>}<p>Book the court with the club, then record the confirmed booking below.</p></> : <p>Use a time proposal to agree when to play with the opposing captain.</p>}
        {context.writable ? <FixtureBooking fixtureId={fixtureId} arrangement={arrangement} suggested={agreed ? { starts_at: agreed.starts_at!, ends_at: agreed.ends_at!, court: agreed.court } : undefined} onSaved={() => void load()}/> : arrangement && <p>Recorded booking: {date(arrangement.starts_at)}{arrangement.court && ` · ${arrangement.court}`}</p>}
        <p className={styles.helper}>Agreeing a time or recording a booking here does not reserve a court.</p></section></aside></div>
    </>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
  </div></main>;
}
