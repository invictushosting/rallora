"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import styles from "./register.module.css";

type Club = { id: string; slug: string; name: string; venue_name:string|null;town:string|null;postcode:string|null;player_registration_terms:string|null };
type Season = { id: string; name: string };
type Division = { id: string; name: string; sort_order: number };
type Team = { id: string; name: string; division_id: string };
type ClubRules = { fixture_rules: string | null; custom_rules: string | null };

export default function PlayerRegistrationPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const supabase = useMemo(() => createClient(), []);
  const [club, setClub] = useState<Club | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [rules, setRules] = useState<ClubRules | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [teamId, setTeamId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const [{ data: auth }, clubReply] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("clubs").select("id,slug,name,venue_name,town,postcode,player_registration_terms").eq("slug", slug).eq("is_active", true).maybeSingle(),
      ]);
      if (!alive) return;
      setUserId(auth.user?.id ?? null);
      if (clubReply.error || !clubReply.data) { setError("This club is unavailable."); return; }
      const nextClub = clubReply.data as Club;
      setClub(nextClub);
      const seasonReply = await supabase.from("seasons").select("id,name")
        .eq("club_id", nextClub.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!alive) return;
      if (seasonReply.error || !seasonReply.data) { setError("Registration is not open for a current season."); return; }
      const nextSeason = seasonReply.data as Season;
      setSeason(nextSeason);
      const rulesReply = await supabase.from("club_rules").select("fixture_rules,custom_rules")
        .eq("club_id", nextClub.id).eq("season_id", nextSeason.id).maybeSingle();
      if (rulesReply.data) setRules(rulesReply.data as ClubRules);
      const divisionReply = await supabase.from("divisions").select("id,name,sort_order")
        .eq("season_id", nextSeason.id).order("sort_order");
      if (divisionReply.error) { setError(divisionReply.error.message); return; }
      const nextDivisions = (divisionReply.data ?? []) as Division[];
      setDivisions(nextDivisions);
      if (!nextDivisions.length) return;
      const teamReply = await supabase.from("teams").select("id,name,division_id")
        .in("division_id", nextDivisions.map((division) => division.id)).order("name");
      if (teamReply.error) { setError(teamReply.error.message); return; }
      setTeams((teamReply.data ?? []) as Team[]);
      if (auth.user) {
        const existing = await supabase.from("rallora_team_registration_requests").select("status,team_id")
          .eq("club_id", nextClub.id).eq("season_id", nextSeason.id).eq("player_user_id", auth.user.id)
          .in("status", ["pending","approved"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
        if(existing.data){setExistingStatus(existing.data.status);setTeamId(existing.data.team_id);}
        const profile = await supabase.from("rallora_player_profiles").select("display_name,phone")
          .eq("user_id", auth.user.id).maybeSingle();
        if (profile.data) { setName(profile.data.display_name ?? ""); setPhone(profile.data.phone ?? ""); }
      }
    }
    if (slug) void load();
    return () => { alive = false; };
  }, [slug, supabase]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      let activeUserId = userId;
      if (!activeUserId) {
        const reply = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.href } });
        if (reply.error) throw reply.error;
        if (!reply.data.user || !reply.data.session) {
          setMessage("Check your email to confirm your account, then return here to submit your request."); return;
        }
        activeUserId = reply.data.user.id; setUserId(activeUserId);
      }
      if (existingStatus) throw new Error(existingStatus==="approved" ? "You are already registered for this season." : "Your registration request is already awaiting review.");
      if (!club || !season || !teamId || !activeUserId) throw new Error("Choose a team before submitting your request.");
      const team = teams.find((item) => item.id === teamId);
      if (!team) throw new Error("Choose a valid team.");
      const profileReply = await supabase.from("rallora_player_profiles").upsert({
        user_id: activeUserId, display_name: name.trim(), phone: phone.trim() || null, updated_at: new Date().toISOString(),
      });
      if (profileReply.error) throw profileReply.error;
      const requestReply = await supabase.from("rallora_team_registration_requests").insert({
        club_id: club.id, season_id: season.id, division_id: team.division_id, team_id: team.id,
        player_user_id: activeUserId, player_name: name.trim(), player_phone: phone.trim() || null,
      });
      if (requestReply.error) throw requestReply.error;
      setMessage("Request submitted. Your club organiser will review it before you are added to the team.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not submit your request."); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}><section className={styles.card}>
    <Link href={club ? `/clubs/${club.slug}` : "/"} className={styles.back}>← Back to club</Link>
    <span className={styles.eyebrow}>PLAYER REGISTRATION</span>
    <h1>{club ? `Join ${club.name}` : "Join a club team"}</h1>
    {club&&(club.venue_name||club.town)&&<p><strong>{[club.venue_name,club.town,club.postcode].filter(Boolean).join(" · ")}</strong></p>}
    <p>Submit your request and a club organiser will approve or decline it. You are not added automatically.</p>
    <aside className={styles.terms}><strong>Before you join</strong><p>{club?.player_registration_terms||rules?.fixture_rules || "Matches must be arranged and played in line with this club’s league rules."}</p>{rules?.custom_rules && <p>{rules.custom_rules}</p>}</aside>
    {existingStatus&&<p className={styles.success} role="status">{existingStatus==="approved"?"You are registered for this season.":"Your registration request is awaiting organiser review."}</p>}<form onSubmit={submit}>
      <label>Full name<input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>Phone <small>(optional)</small><input maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      {!userId && <><label>Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label></>}
      <label>Team<select required value={teamId} onChange={(e) => setTeamId(e.target.value)}><option value="">Choose a team</option>
        {divisions.map((division) => <optgroup key={division.id} label={division.name}>
          {teams.filter((team) => team.division_id === division.id).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </optgroup>)}</select></label>
      {error && <p className={styles.error} role="alert">{error}</p>}{message && <p className={styles.success} role="status">{message}</p>}
      <button disabled={busy || !season || Boolean(existingStatus)}>{busy ? "Submitting…" : userId ? "Submit request" : "Create account & submit"}</button>
    </form>
  </section></main>;
}
