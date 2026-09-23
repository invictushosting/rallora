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
        <span className={styles.eyebrow}>THE PADEL LEAGUE PLATFORM</span>
        <h1>Every club.<br /><span>One home for padel.</span></h1>
        <p>Fixtures, divisions, league tables and results, organised around your club.
          One Rallora platform, built to give each club its own identity.</p>
        <div className={styles.actions}>
          <a href="#clubs" className={styles.primaryButton}>Explore clubs ↗</a>
          <Link href="/register-club" className={styles.secondaryButton}>
            Register your club →
          </Link>
        </div>
        <div className={styles.heroFoot}>
          <span>CLUB-BY-CLUB</span><span>PADEL, SIMPLIFIED</span>
        </div>
      </div>
      <div className={styles.courtArt} aria-hidden="true">
        <div className={`${styles.courtOuter} ${revision.courtOuter}`}><div className={styles.courtInner}>
          <div className={`${styles.courtNet} ${revision.courtNet}`} />
          <div className={revision.courtServiceLines} />
          <div className={revision.courtCentreTop} /><div className={revision.courtCentreBottom} />
        </div></div>
        <div className={styles.ball} />
        <span className={styles.artLabel}>YOUR COURT. YOUR LEAGUE.</span>
      </div>

    </section>

    <section className={styles.productFamily} aria-labelledby="rallora-family">
      <div className={styles.familyHeading}>
        <span className={styles.eyebrow}>ONE RALLORA PLATFORM</span>
        <h2 id="rallora-family">Three products. One connected game.</h2>
        <p>Run your league, share your story and connect with other clubs.</p>
      </div>
      <div className={styles.familyGrid}>
        <Link href="/leagues" className={styles.familyCard}>
          <span>01 / COMPETE</span><h3>Rallora Leagues</h3>
          <p>Fixtures, results, tables and club competitions.</p>
          <strong>Explore Leagues ↗</strong>
        </Link>
        <Link href="/social" className={styles.familyCard}>
          <span>02 / SHARE</span><h3>Rallora Social</h3>
          <p>Create club news and branded posts for the channels players use.</p>
          <strong>Explore Social ↗</strong>
        </Link>
        <Link href="/interclub" className={styles.familyCard}>
          <span>03 / CONNECT · COMING SOON</span><h3>Rallora Interclub</h3>
          <p>A future home for challenges and champions versus champions.</p>
          <strong>Discover Interclub ↗</strong>
        </Link>
      </div>
    </section>

    <section className={styles.clubs} id="clubs" aria-labelledby="club-title">
      <div className={styles.sectionTop}>
        <div><span className={styles.eyebrow}>DISCOVER RALLORA</span>
          <h2 id="club-title">Find your club</h2>
          <p>Choose your club to see its latest league season.</p>
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
      <span className={styles.eyebrow}>BUILT FOR CLUBS</span>
      <h2>The league stays yours.<br />The admin gets easier.</h2>
      <p>League tables, fixtures, results, teams and captain access under one roof.</p>
      <Link href="/register-club">Register your club ↗</Link>
    </section>
    <footer className={styles.footer}>
      <span><strong>rallora.</strong> A padel league platform.</span>
      <span>One platform. Every club.</span>
    </footer>
  </main>;
}
