"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import BackLink from "@/app/components/back-link";
import { createClient } from "@/lib/supabase";
import styles from "./matches.module.css";

type Conversation = { fixture_id: string; league: string; division: string; home: string; away: string; help_requested: boolean; last_activity: string };
export default function MatchInbox() {
  const { slug } = useParams<{ slug: string }>();
  const db = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Conversation[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [helpOnly, setHelpOnly] = useState(false);
  const version = useRef(0);
  const load = useCallback(async () => {
    const current = ++version.current;
    try {
      const auth = await db.auth.getUser();
      if (auth.error || !auth.data.user) throw new Error("Sign in to your club admin account to view match conversations.");
      const club = await db.from("clubs").select("id").eq("slug", slug).single();
      if (club.error) throw new Error("Club unavailable.");
      const rights = await db.rpc("rallora_can_manage_club", { p_club_id: club.data.id });
      if (rights.error || rights.data !== true) throw new Error("Only this club’s organisers can view its match inbox.");
      const [threads, counts] = await Promise.all([
        db.rpc("rallora_club_conversations", { p_club_id: club.data.id }),
        db.rpc("rallora_fixture_conversation_summaries", { p_club_id: club.data.id }),
      ]);
      if (threads.error || counts.error) throw new Error("Could not load the match inbox. Please refresh and try again.");
      if (current !== version.current) return;
      setRows((threads.data ?? []) as Conversation[]);
      setUnread(Object.fromEntries(((counts.data ?? []) as { fixture_id: string; unread_count: number }[]).map(r => [r.fixture_id, Number(r.unread_count)])));
      setError("");
    } catch (e) { if (current === version.current) { setError(e instanceof Error ? e.message : "Could not load conversations."); setRows([]); } }
    finally { if (current === version.current) setLoading(false); }
  }, [db, slug]);
  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    const timer = setInterval(refresh, 15000); window.addEventListener("focus", refresh);
    const invalidate = () => { version.current++; };
    return () => { invalidate(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);
  const visible = helpOnly ? rows.filter(r => r.help_requested) : rows;
  return <main className={styles.page}><div className={styles.shell}><BackLink href={`/clubs/${slug}/admin`}>Back to club admin</BackLink><header><span>CLUB ADMIN</span><h1>Match inbox</h1><p>Help captains arrange fixtures and respond to requests for organiser support.</p></header>
    <div className={styles.controls}><label><input type="checkbox" checked={helpOnly} onChange={event => setHelpOnly(event.target.checked)}/> Help requests only ({rows.filter(r => r.help_requested).length})</label><button disabled={loading} onClick={() => void load()}>Refresh inbox</button></div>
    {loading ? <p role="status">Loading match inbox…</p> : error ? <p role="alert">{error}</p> : <><p>Showing up to 100 conversations, with unresolved help requests first.</p><section className={styles.list}>{visible.map(row => <Link href={`/clubs/${slug}/matches/${row.fixture_id}`} key={row.fixture_id} className={styles.card}><div><span>{row.league} · {row.division}</span><h2>{row.home} vs {row.away}</h2><p>{row.help_requested ? "Organiser help requested" : "Match conversation"} · Last activity {new Date(row.last_activity).toLocaleString("en-GB")}</p></div><strong>{unread[row.fixture_id] > 0 ? `${unread[row.fixture_id]} unread` : "Open match →"}</strong></Link>)}</section>{!visible.length && <p>{helpOnly ? "No unresolved help requests." : "No conversations yet. Captains can open Arrange match from their fixtures."}</p>}</>}
  </div></main>;
}
