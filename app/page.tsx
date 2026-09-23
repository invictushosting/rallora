"use client";

import RalloraLogo from "@/app/components/rallora-logo";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import styles from "./page.module.css";
import revision from "./revision.module.css";

type Club = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
  welcome_text: string | null;
  logo_url: string | null;
};
type Season = { id: string; club_id: string; status: string; name: string };
type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; clubs: Club[]; seasons: Season[] };

function safeColor(color: string | null) {
  return color && /^#[\da-fA-F]{6}$/.test(color) ? color : "#4169f3";
}
function safeImage(url: string | null) {
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try { const parsed = new URL(url); return parsed.protocol === "https:" ? parsed.href : null; }
  catch { return null; }
}

export default function RalloraHome() {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [clubSearch, setClubSearch] = useState("");

  useEffect(() => {
    // Preserve old GSM bookmarks (#admin, #captain, #fixtures, etc.)
    // without creating a second live app or an endless redirect loop.
    const legacyHash = /^(#admin|#captain|#fixtures|#tables|#teams|#cup|#team=)/i;
    if (legacyHash.test(window.location.hash)) {
      window.location.replace(`/clubs/gsm-padel/legacy${window.location.hash}`);
      return;
    }

    let active = true;
    async function load() {
      try {
        const { data: clubs, error } = await supabase
          .from("clubs")
          .select("id,slug,name,short_name,primary_color,welcome_text,logo_url")
          .eq("is_active", true)
          .order("created_at", { ascending: true });
        if (error) throw error;
        const clubRows = (clubs ?? []) as Club[];
        const clubIds = clubRows.map((club) => club.id);
        if (!clubIds.length) {
          if (active) setState({ kind: "ready", clubs: [], seasons: [] });
          return;
        }
        const { data: seasons, error: seasonError } = await supabase
          .from("seasons").select("id,club_id,status,name")
          .in("club_id", clubIds);
        if (seasonError) throw seasonError;
        if (active) setState({
          kind: "ready",
          clubs: clubRows,
          seasons: ((seasons ?? []) as Season[]).filter(
            (season) => clubIds.includes(season.club_id),
          ),
        });
      } catch (error) {
        if (active) setState({
          kind: "error",
          message: error instanceof Error ? error.message : "Club directory unavailable.",
        });
      }
    }
    void load();
    return () => { active = false; };
  }, [supabase]);

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.wordmark} aria-label="Rallora home">
        <RalloraLogo variant="light" width={218} />
      </Link>
      <nav className={styles.nav} aria-label="Main navigation">
        <a href="#clubs">Find your club</a>
        <Link href="/products">Products</Link>
        <a href="#clubs" className={styles.navButton}>Club &amp; captain login →</a>
      </nav>
    </header>

    <section className={styles.hero}>
      <div className={styles.heroContent}>
        <span className={styles.eyebrow}>PRE-LAUNCH · NOW ONBOARDING PILOT CLUBS</span>
        <h1>The smarter way to<br /><span>run your padel leagues.</span></h1>
        <p>Rallora brings league management, results, player communication and social content together in one platform — built specifically for padel clubs.</p>
        <div className={styles.actions}>
          <Link href="/register-club" className={styles.primaryButton}>Join the pilot programme ↗</Link>
          <a href="#workflow" className={styles.secondaryButton}>See how Rallora works →</a>
        </div>
        <div className={styles.heroFoot}>
          <span>LEAGUES · RESULTS · COMMS</span><span>SOCIAL CONTENT · ONE WORKFLOW</span>
        </div>
      </div>
      <div className={styles.courtArt} aria-hidden="true">
        <div className={`${styles.courtOuter} ${revision.courtOuter}`}><div className={styles.courtInner}>
          <div className={`${styles.courtNet} ${revision.courtNet}`} />
          <div className={revision.courtServiceLines} />
          <div className={revision.courtCentreTop} /><div className={revision.courtCentreBottom} />
        </div></div>
        <div className={styles.ball} />
        <span className={styles.artLabel}>YOUR LEAGUE. LESS ADMIN.</span>
      </div>

    </section>

    <section className={styles.productFamily} id="workflow" aria-labelledby="rallora-family">
      <div className={styles.familyHeading}>
        <span className={styles.eyebrow}>FROM FIXTURE TO SOCIAL POST</span>
        <h2 id="rallora-family">Run the league. Rallora handles the flow.</h2>
        <p>Create competitions, let captains submit results, keep tables moving and turn league activity into club content.</p>
      </div>
      <div className={styles.familyGrid}>
        <Link href="/leagues" className={styles.familyCard}>
          <span>01 / RUN</span><h3>League management</h3>
          <p>Divisions, teams, fixtures, results and standings in one club dashboard.</p>
          <strong>Explore Leagues ↗</strong>
        </Link>
        <Link href="/social" className={styles.familyCard}>
          <span>02 / AUTOMATE</span><h3>Captain-led results</h3>
          <p>Give captains secure access to submit match results and keep the competition moving.</p>
          <strong>See the workflow ↗</strong>
        </Link>
        <Link href="/interclub" className={styles.familyCard}>
          <span>03 / SHARE</span><h3>Rallora Social Studio</h3>
          <p>Turn fixtures, results and league moments into professional branded club content.</p>
          <strong>Explore Social ↗</strong>
        </Link>
      </div>
    </section>

    <section className={styles.clubs} id="clubs" aria-labelledby="club-title">
      <div className={styles.sectionTop}>
        <div><span className={styles.eyebrow}>RALLORA IN ACTION</span>
          <h2 id="club-title">Explore a Rallora club</h2>
          <p>See the live club experience, or join the pilot programme to bring your leagues onto Rallora.</p>
        </div>
        {state.kind === "ready" && <span className={styles.count}>
          {state.clubs.length} {state.clubs.length === 1 ? "CLUB" : "CLUBS"}
        </span>}
      </div>

      <label className={revision.clubSearch}>
        <span>Search clubs</span>
        <input type="search" value={clubSearch} placeholder="Search by club name…"
          onChange={(event) => setClubSearch(event.target.value)} />
      </label>

      {state.kind === "loading" && <p className={styles.notice} role="status">Loading clubs…</p>}
      {state.kind === "error" && <p className={styles.notice} role="alert">
        Clubs could not be loaded. {state.message}
      </p>}
      {state.kind === "ready" && !state.clubs.length &&
        <p className={styles.notice}>No clubs are published yet.</p>}

      {state.kind === "ready" && <div className={styles.grid}>
        {state.clubs.filter((club) => [club.name, club.short_name, club.slug]
          .some((value) => value?.toLowerCase().includes(clubSearch.trim().toLowerCase())))
          .map((club) => {
          const clubSeasons = state.seasons.filter((season) => season.club_id === club.id);
          const activeSeason = clubSeasons.find((season) => season.status === "active");
          const color = safeColor(club.primary_color);
          const logo = safeImage(club.logo_url);
          const isDemo = club.slug === "new-padel-club";
          return <article className={styles.club} key={club.id}
            style={{ "--club-accent": color } as React.CSSProperties}>
            <div className={styles.clubHead}>
              <span className={`${styles.clubMark} ${logo ? revision.clubLogo : ""}`}>
                {logo ? <img src={logo} alt={`${club.name} logo`} />
                  : (club.short_name || club.name).slice(0, 2).toUpperCase()}
              </span>
              <span className={styles.activeBadge}>
                {isDemo ? "DEMO CLUB" : "CLUB HUB"}</span>
            </div>
            <h3>{club.name}</h3>
            <p className={styles.slug}>rallora / {club.slug}</p>
            <p className={styles.description}>{isDemo
              ? "Explore a demonstration club with sample competition data."
              : club.welcome_text || "Your club's league, all in one place."}</p>
            <div className={styles.clubDetails}>
              <span>SEASONS <strong>{clubSeasons.length}</strong></span>
              <span>NOW PLAYING <strong>{activeSeason?.name || "Coming soon"}</strong></span>
            </div>
            <Link className={styles.clubLink} href={`/clubs/${encodeURIComponent(club.slug)}`}>
              Explore club <span>↗</span>
            </Link>
            <div className={revision.loginLinks}>
              <Link href={`/clubs/${encodeURIComponent(club.slug)}/admin`}>Club login</Link>
              <Link href={`/clubs/${encodeURIComponent(club.slug)}/captain`}>Captain login</Link>
            </div>
          </article>;
        })}
      </div>}
    </section>

    <section className={styles.bottom}>
      <span className={styles.eyebrow}>PILOT CLUBS</span>
      <h2>Help shape the future of<br />padel league management.</h2>
      <p>We’re onboarding a small number of clubs for early access, hands-on support and direct input into Rallora’s development.</p>
      <Link href="/register-club">Apply to become a pilot club ↗</Link>
    </section>
    <footer className={styles.footer}>
      <span><strong>rallora.</strong> A padel league platform.</span>
      <span>One platform. Every club.</span>
    </footer>
  </main>;
}
