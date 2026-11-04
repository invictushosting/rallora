"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import BackLink from "@/app/components/back-link";
import { createClient } from "@/lib/supabase";
import { captainContacts, type CaptainContact } from "@/lib/captain-contacts";
import { captainContactsCsv } from "@/lib/leagues/exports";
import styles from "./contacts.module.css";

type League = { id: string; name: string };
// Supabase caps result sizes; paginate so downloads never silently omit teams.
async function allRows<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const reply = await query(offset, offset + 499);
    if (reply.error) throw new Error(reply.error.message);
    rows.push(...(reply.data ?? []));
    if ((reply.data?.length ?? 0) < 500) return rows;
  }
}

export default function CaptainContactsPage() {
  const { slug } = useParams<{ slug: string }>();
  const db = useMemo(() => createClient(), []);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [seasonId, setSeasonId] = useState("");
  const [club, setClub] = useState<{ id: string; name: string } | null>(null);
  const [contacts, setContacts] = useState<CaptainContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const auth = await db.auth.getUser();
        if (auth.error || !auth.data.user) throw new Error("Sign in through club admin to view captain contacts.");
        const clubReply = await db.from("clubs").select("id,name").eq("slug", slug).single();
        if (clubReply.error) throw new Error("Club unavailable.");
        const allowed = await db.rpc("rallora_can_manage_club", { p_club_id: clubReply.data.id });
        if (allowed.error || allowed.data !== true) throw new Error("Only this club’s admins and organisers can view captain contacts.");
        const seasons = await allRows((from, to) => db.from("seasons").select("id,name").eq("club_id", clubReply.data.id).order("created_at", { ascending: false }).order("id").range(from, to));
        if (alive) { setClub(clubReply.data); setLeagues(seasons); setSeasonId(seasons[0]?.id ?? ""); setLoading(false); }
      } catch (e) { if (alive) { setError(e instanceof Error ? e.message : "Could not load club."); setLoading(false); } }
    })();
    return () => { alive = false; };
  }, [db, slug]);

  useEffect(() => {
    if (!club || !seasonId) return;
    let alive = true;
    setLoading(true); setError(""); setNotice(""); setContacts([]);
    void (async () => {
      try {
        const [divisions, roster, applications, registrations] = await Promise.all([
          allRows((from, to) => db.from("divisions").select("id,name").eq("season_id", seasonId).order("id").range(from, to)),
          allRows((from, to) => db.from("rallora_team_roster_memberships").select("team_id,player_user_id,registration_request_id,role").eq("club_id", club.id).eq("season_id", seasonId).eq("role", "captain").order("id").range(from, to)),
          allRows((from, to) => db.from("rallora_team_applications").select("created_team_id,requested_by,captain_name,captain_phone,status").eq("club_id", club.id).eq("season_id", seasonId).eq("status", "approved").order("id").range(from, to)),
          allRows((from, to) => db.from("rallora_team_registration_requests").select("id,team_id,player_user_id,player_name,player_phone,status").eq("club_id", club.id).eq("season_id", seasonId).eq("status", "approved").order("id").range(from, to)),
        ]);
        const teams = [];
        // Keep each IN query small even for clubs with many divisions.
        for (const division of divisions) {
          teams.push(...await allRows((from, to) => db.from("teams").select("id,division_id,name,captain_email,player_one_name,player_two_name,player_one_email,player_two_email").eq("division_id", division.id).eq("is_active", true).order("id").range(from, to)));
        }
        if (alive) setContacts(captainContacts(club.name, leagues.find(s => s.id === seasonId)?.name ?? "", divisions, teams, roster, applications, registrations));
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : "Could not load captain contacts."); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [db, club, seasonId, leagues]);

  function download() {
    try {
      const url = URL.createObjectURL(new Blob([captainContactsCsv(contacts)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url;
      link.download = `${slug}-captain-contacts-${seasonId}.csv`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Captain contacts downloaded. Import the mobile number column as text to preserve + prefixes and leading zeros.");
    } catch { setNotice("Download unavailable. Please try another browser."); }
  }

  return <main className={styles.page}><div className={styles.shell}>
    <BackLink href={`/clubs/${slug}/admin`}>Back to club admin</BackLink>
    <header><span className={styles.eyebrow}>CLUB ADMIN</span><h1>Captain contacts</h1><p>View and download captain numbers shared with {club?.name ?? "your club"} for league coordination.</p></header>
    {club && <div className={styles.controls}><label htmlFor="contact-league">League<select id="contact-league" value={seasonId} onChange={e => { setContacts([]); setLoading(true); setSeasonId(e.target.value); }}>{leagues.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button type="button" onClick={download} disabled={loading || !!error || !contacts.length}>Download CSV</button></div>}
    {error ? <p role="alert">{error}</p> : loading ? <p role="status">Loading captain contacts…</p> : !leagues.length ? <p>No leagues available.</p> : <><p>{contacts.length} captain entries · {contacts.filter(c => c.phone).length} with a mobile number. Numbers are optional; blank entries need follow-up with the captain.</p><div className={styles.tableWrap}><table><caption>Captain contacts for {leagues.find(s => s.id === seasonId)?.name}</caption><thead><tr><th scope="col">Division</th><th scope="col">Team</th><th scope="col">Captain</th><th scope="col">Mobile number</th></tr></thead><tbody>{contacts.map((c, i) => <tr key={`${c.teamId}-${i}`}><td>{c.division}</td><td>{c.team}</td><td>{c.captain}</td><td>{c.phone || "Not provided"}</td></tr>)}</tbody></table></div>{!contacts.length && <p>No active teams in this league yet.</p>}</>}
    {notice && <p role="status">{notice}</p>}
  </div></main>;
}
