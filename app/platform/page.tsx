"use client";

import RalloraLogo from "@/app/components/rallora-logo";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import styles from "./platform.module.css";

type Club = { id: string; slug: string; name: string; is_active: boolean };
type Season = {
  id: string; club_id: string; name: string;
  status: "draft" | "active" | "completed";
};
type ClubSummary = { club: Club; seasons: Season[]; teams: number; fixtures: number };
type View =
  | { status: "loading" | "signed_out" | "forbidden" }
  | { status: "error"; message: string }
  | { status: "ready"; clubs: ClubSummary[] };

/** Initial read-only overview. Authorization for future write actions must be server-side
 * and enforced with club-scoped RLS; rendering this page is not a write authorization. */
export default function PlatformControlCentre() {
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<View>({ status: "loading" });
  useEffect(() => {
    let current = true;
    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError && authError.name !== "AuthSessionMissingError") throw authError;
        if (!user) {
          if (current) setView({ status: "signed_out" });
          return;
        }
        const { data: admin, error: adminError } = await supabase
          .from("rallora_platform_admins").select("user_id")
          .eq("user_id", user.id).maybeSingle();
        if (adminError) throw adminError;
        if (!admin) {
          if (current) setView({ status: "forbidden" });
          return;
        }
        const { data: rows, error: clubsError } = await supabase
          .from("clubs").select("id, slug, name, is_active")
          .order("name", { ascending: true });
        if (clubsError) throw clubsError;
        const summaries: ClubSummary[] = await Promise.all(
          ((rows ?? []) as Club[]).map(async (club) => {
            const { data: seasonRows, error: seasonError } = await supabase
              .from("seasons").select("id, club_id, name, status")
              .eq("club_id", club.id).order("created_at", { ascending: false });
            if (seasonError) throw seasonError;
            const seasons = (seasonRows ?? []) as Season[];
            if (!seasons.length) return { club, seasons, teams: 0, fixtures: 0 };
            const ids = seasons.map(s => s.id);
            const { data: divisionRows, error: divisionError } = await supabase
              .from("divisions").select("id").in("season_id", ids);
            if (divisionError) throw divisionError;
            const divisionIds = (divisionRows ?? []).map(d => d.id as string);
            const [fixtureCount, teamCount] = await Promise.all([
              supabase.from("fixtures").select("id", { count: "exact", head: true })
                .in("season_id", ids),
              divisionIds.length
                ? supabase.from("teams").select("id", { count: "exact", head: true })
                    .in("division_id", divisionIds)
                : Promise.resolve({ count: 0, error: null }),
            ]);
            if (fixtureCount.error) throw fixtureCount.error;
            if (teamCount.error) throw teamCount.error;
            return {
              club, seasons,
              teams: teamCount.count ?? 0,
              fixtures: fixtureCount.count ?? 0,
            };
          }),
        );
        if (current) setView({ status: "ready", clubs: summaries });
      } catch (e) {
        if (current) setView({
          status: "error",
          message: e instanceof Error ? e.message : "Could not load clubs.",
        });
      }
    }
    void load();
    // Defer rechecking until outside the Supabase auth callback.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void load(); }, 0);
    });
    return () => {
      current = false;
      if (timer) clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const summaries = view.status === "ready" ? view.clubs : [];
  const totals = {
    activeClubs: summaries.filter(s => s.club.is_active).length,
    activeSeasons: summaries.reduce(
      (n, s) => n + s.seasons.filter(season => season.status === "active").length, 0),
    teams: summaries.reduce((n, s) => n + s.teams, 0),
    fixtures: summaries.reduce((n, s) => n + s.fixtures, 0),
  };
  return <main className={styles.page}><div className={styles.shell}>
    <nav className={styles.nav}>
      <RalloraLogo variant="light" width={218} /><span>Platform Control Centre</span>
      <span className={styles.badge}>READ-ONLY · PHASE 1</span>
    </nav>
    <header className={styles.hero}>
      <small>ONE PLATFORM. EVERY CLUB.</small>
      <h1>Club operations, all in one place.</h1>
      <p>Platform oversight is separate from each club’s own league administration.</p>
    </header>
    {view.status === "loading" && <p className={styles.notice} role="status">Checking administrator access and loading clubs…</p>}
    {view.status === "signed_out" && <section className={styles.notice}>
      <h2>Sign in required</h2><p>Sign in using the existing Rallora admin area.</p>
      <a href="/#admin">Open administrator sign-in →</a>
    </section>}
    {view.status === "forbidden" && <section className={styles.notice} role="alert">
      <h2>Access denied</h2><p>This area is available only to Rallora platform administrators.</p>
    </section>}
    {view.status === "error" && <section className={styles.notice} role="alert">
      <h2>Could not load the control centre</h2><p>{view.message}</p>
    </section>}
    {view.status === "ready" && <>
      <section className={styles.metrics} aria-label="Platform summary">
        {([["Clubs", summaries.length], ["Active clubs", totals.activeClubs],
          ["Active seasons", totals.activeSeasons], ["Teams", totals.teams],
          ["Fixtures", totals.fixtures]] as [string, number][])
          .map(([label, count]) => <div className={styles.metric} key={label}>
            <span>{label}</span><strong>{count.toLocaleString("en-GB")}</strong>
          </div>)}
      </section>
      <h2>Registered clubs</h2>
      <section className={styles.grid} aria-label="Registered clubs">
        {summaries.map(({ club, seasons, teams, fixtures }) =>
          <article className={styles.card} key={club.id}>
            <span className={styles.clubIcon}>{club.name.slice(0, 1).toUpperCase()}</span>
            <span className={styles.status}>{club.is_active ? "ACTIVE" : "INACTIVE"}</span>
            <h3>{club.name}</h3><p className={styles.slug}>/{club.slug}</p>
            <dl className={styles.clubMetrics}>
              <div><dt>Seasons</dt><dd>{seasons.length}</dd></div>
              <div><dt>Teams</dt><dd>{teams}</dd></div>
              <div><dt>Fixtures</dt><dd>{fixtures}</dd></div>
            </dl>
            <strong>Seasons</strong>
            {seasons.map(s => <div className={styles.season} key={s.id}>
              <span>{s.name}</span><em>{s.status}</em>
            </div>)}
            {!seasons.length && <p>No seasons created yet.</p>}
            <p><a href={`/clubs/${encodeURIComponent(club.slug)}`}>View this club’s league hub →</a></p>
            <p><a href={`/clubs/${encodeURIComponent(club.slug)}/admin`}>Open club administration →</a></p>
            {club.slug === "gsm-padel" && <p><a href="/clubs/gsm-padel">Open full GSM league →</a></p>}
          </article>)}
      </section>
      <p className={styles.footnote}>
        Club editing and self-service onboarding remain disabled until club-scoped
        permissions and an isolated development database are tested.
      </p>
    </>}
  </div></main>;
}
