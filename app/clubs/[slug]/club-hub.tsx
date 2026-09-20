"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import styles from "./club.module.css";

type Club = {
  id: string; slug: string; name: string; short_name: string | null;
  primary_color: string | null; welcome_title: string | null;
  welcome_text: string | null; footer_text: string | null;
};
type Season = {
  id: string; club_id: string; name: string; status: string;
  starts_on: string | null; created_at: string;
};
type Division = { id: string; season_id: string; name: string; sort_order: number };
type Team = {
  id: string; division_id: string; name: string;
  player_one_name: string | null; player_two_name: string | null;
};
type Fixture = {
  id: string; season_id: string; division_id: string;
  home_team_id: string; away_team_id: string;
  play_by: string; week_number: number;
  fixture_group_name: string | null; status: string; court: string | null;
  available_from: string | null;
};
type Result = {
  fixture_id: string; home_score: string | null;
  away_score: string | null; status: string; confirmed_at: string | null;
};
type Standing = {
  team_id: string; division_id: string; played: number; won: number;
  drawn: number; lost: number; points: number; score_diff: number;
};
type Sponsor = {
  id: string; name: string; sponsor_type: string | null;
  logo_url: string | null; website_url: string | null;
};
type Announcement = { id: string; title: string; body: string; created_at: string };
type CupRule = {
  division_id: string; qualifier_count: number; is_active: boolean;
};
type CupQualifier = {
  team_id: string; seed_position: number; is_active: boolean;
};
type ClubContent = { sponsors: Sponsor[]; announcements: Announcement[] };
type LeagueData = {
  divisions: Division[]; teams: Team[]; fixtures: Fixture[];
  results: Result[]; standings: Standing[];
  cupRules: CupRule[]; cupQualifiers: CupQualifier[];
};
type ClubState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "ready"; club: Club; seasons: Season[]; content: ClubContent };
type Tab = "overview" | "tables" | "fixtures" | "results" | "teams" | "cup";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" }, { id: "tables", label: "Tables" },
  { id: "fixtures", label: "Fixtures" }, { id: "results", label: "Results" },
  { id: "teams", label: "Teams" }, { id: "cup", label: "League cup" },
];
const EMPTY: LeagueData = {
  divisions: [], teams: [], fixtures: [], results: [], standings: [],
  cupRules: [], cupQualifiers: [],
};
function safeColor(color: string | null) {
  return color && /^#[\da-fA-F]{6}$/.test(color) ? color : "#2458ff";
}
function safeLink(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : null;
  } catch { return null; }
}
function dateLabel(value: string | null) {
  if (!value) return "Date to arrange";
  const date = new Date(value.slice(0, 10) + "T12:00:00Z");
  return Number.isNaN(date.getTime()) ? "Date to arrange"
    : new Intl.DateTimeFormat("en-GB", {
      day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
    }).format(date);
}
function isConfirmed(result: Result | undefined) {
  return Boolean(result && ["confirmed", "admin_override"].includes(result.status));
}
function teamLabel(id: string, names: Map<string, string>) {
  return names.get(id) ?? "Team unavailable";
}

export default function ClubLeagueHub({ slugOverride }: { slugOverride?: string } = {}) {
  const params = useParams();
  const slug = slugOverride ?? (typeof params.slug === "string" ? params.slug : "");
  const supabase = useMemo(() => createClient(), []);
  const [clubState, setClubState] = useState<ClubState>({ kind: "loading" });
  const [seasonId, setSeasonId] = useState("");
  const [data, setData] = useState<LeagueData>(EMPTY);
  const [dataState, setDataState] = useState<"loading" | "ready" | "error">("loading");
  const [dataError, setDataError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    setClubState({ kind: "loading" });
    setSeasonId("");
    setData(EMPTY);
    setTab("overview");
    async function loadClub() {
      try {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          if (alive) setClubState({ kind: "missing" });
          return;
        }
        const { data: club, error: clubError } = await supabase
          .from("clubs")
          .select("id,slug,name,short_name,primary_color,welcome_title,welcome_text,footer_text")
          .eq("slug", slug).eq("is_active", true).maybeSingle();
        if (clubError) throw clubError;
        if (!club) {
          if (alive) setClubState({ kind: "missing" });
          return;
        }
        const [seasonsReply, sponsorsReply, announcementsReply] = await Promise.all([
          supabase.from("seasons")
            .select("id,club_id,name,status,starts_on,created_at")
            .eq("club_id", club.id)
            // Do not show draft seasons or their fixtures on public club pages.
            .in("status", ["active", "completed"])
            .order("created_at", { ascending: false }),
          supabase.from("sponsors")
            .select("id,name,sponsor_type,logo_url,website_url")
            .eq("club_id", club.id).eq("is_active", true)
            .order("sort_order", { ascending: true }),
          supabase.from("announcements")
            .select("id,title,body,created_at")
            .eq("club_id", club.id).eq("is_published", true)
            .order("created_at", { ascending: false }).limit(5),
        ]);
        if (seasonsReply.error) throw seasonsReply.error;
        if (sponsorsReply.error) throw sponsorsReply.error;
        if (announcementsReply.error) throw announcementsReply.error;
        const seasons = ((seasonsReply.data ?? []) as Season[])
          .filter((season) => season.club_id === club.id &&
            ["active", "completed"].includes(season.status))
          .sort((a, b) => Number(b.status === "active") -
            Number(a.status === "active"));
        if (alive) {
          setClubState({
            kind: "ready", club: club as Club, seasons,
            content: {
              sponsors: (sponsorsReply.data ?? []) as Sponsor[],
              announcements: (announcementsReply.data ?? []) as Announcement[],
            },
          });
          setSeasonId(seasons[0]?.id ?? "");
        }
      } catch (error) {
        if (alive) setClubState({
          kind: "error",
          message: error instanceof Error ? error.message : "Club could not be loaded.",
        });
      }
    }
    void loadClub();
    return () => { alive = false; };
  }, [slug, supabase]);

  useEffect(() => {
    setDivisionFilter("all");
    setSearch("");
    setShowAll(false);
    if (clubState.kind !== "ready" || !seasonId) {
      setData(EMPTY);
      return;
    }
    const season = clubState.seasons.find(
      (value) => value.id === seasonId && value.club_id === clubState.club.id,
    );
    if (!season) {
      setData(EMPTY);
      setDataError("This season does not belong to this club.");
      setDataState("error");
      return;
    }
    const verifiedSeasonId = season.id;
    let alive = true;
    setData(EMPTY);
    setDataError("");
    setDataState("loading");

    async function loadSeason() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [divisionReply, fixtureReply, standingReply, cupReply, manualReply] =
          await Promise.all([
            supabase.from("divisions")
              .select("id,season_id,name,sort_order")
              .eq("season_id", verifiedSeasonId).order("sort_order", { ascending: true }),
            supabase.from("fixtures")
              .select("id,season_id,division_id,home_team_id,away_team_id,play_by,week_number,fixture_group_name,status,court,available_from")
              .eq("season_id", verifiedSeasonId)
              .or(`available_from.is.null,available_from.lte.${today}`)
              .order("play_by", { ascending: true }),
            supabase.from("standings")
              .select("team_id,division_id,played,won,drawn,lost,points,score_diff")
              .eq("season_id", verifiedSeasonId),
            supabase.from("cup_qualifier_rules")
              .select("division_id,qualifier_count,is_active")
              .eq("season_id", verifiedSeasonId),
            supabase.from("cup_manual_qualifiers")
              .select("team_id,seed_position,is_active")
              .eq("season_id", verifiedSeasonId),
          ]);
        for (const reply of [divisionReply, fixtureReply, standingReply, cupReply, manualReply]) {
          if (reply.error) throw reply.error;
        }
        const divisions = ((divisionReply.data ?? []) as Division[])
          .filter((division) => division.season_id === verifiedSeasonId);
        const divisionIds = new Set(divisions.map((division) => division.id));
        const fixtures = ((fixtureReply.data ?? []) as Fixture[])
          .filter((fixture) =>
            fixture.season_id === verifiedSeasonId &&
            divisionIds.has(fixture.division_id) &&
            (!fixture.available_from || fixture.available_from <= today));
        const fixtureIds = fixtures.map((fixture) => fixture.id);
        const [teamsReply, resultReply] = await Promise.all([
          divisionIds.size
            ? supabase.from("teams")
              .select("id,division_id,name,player_one_name,player_two_name")
              .in("division_id", [...divisionIds]).eq("is_active", true)
              .order("name", { ascending: true })
            : Promise.resolve({ data: [] as Team[], error: null }),
          fixtureIds.length
            ? supabase.from("results")
              .select("fixture_id,home_score,away_score,status,confirmed_at")
              .in("fixture_id", fixtureIds)
              .in("status", ["confirmed", "admin_override"])
            : Promise.resolve({ data: [] as Result[], error: null }),
        ]);
        if (teamsReply.error) throw teamsReply.error;
        if (resultReply.error) throw resultReply.error;
        const teams = ((teamsReply.data ?? []) as Team[])
          .filter((team) => divisionIds.has(team.division_id));
        const teamIds = new Set(teams.map((team) => team.id));
        const publishedFixtures = fixtures.filter(
          (fixture) => teamIds.has(fixture.home_team_id) &&
            teamIds.has(fixture.away_team_id),
        );
        const publishedFixtureIds = new Set(publishedFixtures.map((fixture) => fixture.id));
        if (alive) {
          setData({
            divisions, teams, fixtures: publishedFixtures,
            standings: ((standingReply.data ?? []) as Standing[])
              .filter((row) => divisionIds.has(row.division_id) &&
                teamIds.has(row.team_id)),
            results: ((resultReply.data ?? []) as Result[])
              .filter((result) => publishedFixtureIds.has(result.fixture_id) &&
                isConfirmed(result)),
            cupRules: ((cupReply.data ?? []) as CupRule[])
              .filter((rule) => divisionIds.has(rule.division_id) && rule.is_active),
            cupQualifiers: ((manualReply.data ?? []) as CupQualifier[])
              .filter((value) => teamIds.has(value.team_id) && value.is_active),
          });
          setDataState("ready");
        }
      } catch (error) {
        if (alive) {
          setDataState("error");
          setDataError(error instanceof Error ? error.message : "Season data could not be loaded.");
        }
      }
    }
    void loadSeason();
    return () => { alive = false; };
  }, [clubState, seasonId, supabase]);

  if (clubState.kind !== "ready") {
    const message = clubState.kind === "loading" ? "Loading your club…" :
      clubState.kind === "missing" ? "This club is not publicly available." :
      clubState.message;
    return <main className={styles.page}><div className={styles.center}
      role={clubState.kind === "error" ? "alert" : "status"}>
      <span className={styles.brand}><span>R</span> rallora.</span>
      <h1>{clubState.kind === "missing" ? "Club not found" :
        clubState.kind === "error" ? "Could not load club" : "Finding your club"}</h1>
      <p>{message}</p><a href="/">Back to Rallora →</a>
    </div></main>;
  }

  const { club, seasons, content } = clubState;
  const currentSeason = seasons.find((season) => season.id === seasonId);
  const teamNames = new Map(data.teams.map((team) => [team.id, team.name]));
  const results = new Map(data.results.map((result) => [result.fixture_id, result]));
  const standings = (id: string) => data.standings
    .filter((row) => row.division_id === id)
    .sort((a, b) => b.points - a.points || b.score_diff - a.score_diff ||
      teamLabel(a.team_id, teamNames).localeCompare(teamLabel(b.team_id, teamNames)));
  const confirmed = data.fixtures.filter((fixture) =>
    isConfirmed(results.get(fixture.id))).length;
  const matchingFixtures = data.fixtures
    .filter((fixture) => divisionFilter === "all" ||
      fixture.division_id === divisionFilter)
    .filter((fixture) => {
      const term = search.trim().toLowerCase();
      return !term || [teamNames.get(fixture.home_team_id),
        teamNames.get(fixture.away_team_id), fixture.fixture_group_name,
        fixture.court, String(fixture.week_number)].some((value) =>
        value?.toLowerCase().includes(term));
    });
  const fixturesForTab = matchingFixtures.filter((fixture) =>
    tab === "results" ? isConfirmed(results.get(fixture.id)) :
      !isConfirmed(results.get(fixture.id)));
  const sortedFixtures = [...fixturesForTab].sort((a, b) =>
    tab === "results" ? b.play_by.localeCompare(a.play_by) :
      a.play_by.localeCompare(b.play_by));
  const visibleFixtures = showAll ? sortedFixtures : sortedFixtures.slice(0, 18);
  const filteredDivisions = data.divisions.filter((division) =>
    divisionFilter === "all" || division.id === divisionFilter);

  function fixtureRow(fixture: Fixture) {
    const result = results.get(fixture.id);
    const resolved = isConfirmed(result);
    return <li key={fixture.id} className={styles.fixture}>
      <div className={styles.fixtureTop}>
        <span>{data.divisions.find((division) =>
          division.id === fixture.division_id)?.name ?? "Division"}</span>
        <span>{fixture.fixture_group_name ||
          (fixture.week_number ? `Week ${fixture.week_number}` : "League fixture")}</span>
        <span>{dateLabel(fixture.play_by)}</span>
      </div>
      <div className={styles.match}>
        <strong>{teamLabel(fixture.home_team_id, teamNames)}</strong>
        <span className={styles.score}>{resolved
          ? `${result?.home_score ?? "–"} : ${result?.away_score ?? "–"}`
          : "vs"}</span>
        <strong>{teamLabel(fixture.away_team_id, teamNames)}</strong>
      </div>
      <div className={styles.fixtureBottom}>
        <span>{fixture.court || "Court to arrange"}</span>
        <span className={resolved ? styles.confirmed : styles.fixtureStatus}>
          {resolved ? "Final" : fixture.status === "disputed" ?
            "Under review" : "Awaiting result"}
        </span>
      </div>
    </li>;
  }
  function tableFor(division: Division) {
    const rows = standings(division.id);
    return <div className={styles.tableWrap}><table>
      <thead><tr><th scope="col">#</th><th scope="col">Team</th>
        <th scope="col">P</th><th scope="col">W</th>
        <th scope="col">D</th><th scope="col">L</th>
        <th scope="col">Diff</th><th scope="col">Pts</th></tr></thead>
      <tbody>{rows.map((row, index) =>
        <tr key={row.team_id}><td>{index + 1}</td>
          <th scope="row">{teamLabel(row.team_id, teamNames)}</th>
          <td>{row.played}</td><td>{row.won}</td>
          <td>{row.drawn}</td><td>{row.lost}</td>
          <td>{row.score_diff > 0 ? `+${row.score_diff}` : row.score_diff}</td>
          <td className={styles.points}>{row.points}</td></tr>)}</tbody>
    </table>
      {!rows.length && <p className={styles.empty}>No league table published yet.</p>}
    </div>;
  }

  return <main className={styles.page}
    style={{ "--club-color": safeColor(club.primary_color) } as React.CSSProperties}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <a href="/" className={styles.brand} aria-label="Rallora home">
          <span>R</span> rallora.</a>
        <a href={`/clubs/${encodeURIComponent(slug)}/admin`}
          className={styles.adminLink}>Club administration ↗</a>
      </header>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>{club.short_name || "PADEL"} · LEAGUE HUB</span>
        <h1>{club.name}</h1>
        <p>{club.welcome_text || "Fixtures, results and league tables. All in one place."}</p>
        <div className={styles.heroFooter}>
          <span>{currentSeason?.name ?? club.welcome_title ?? "Club league"}</span>
          <span>Powered by Rallora</span>
        </div>
      </section>
      <div className={styles.toolbar}>
        <div><span className={styles.kicker}>YOUR CLUB. YOUR LEAGUE.</span>
          <h2>League centre</h2></div>
        {seasons.length > 0 && <label className={styles.seasonPicker}>
          <span>Season</span>
          <select value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>
            {seasons.map((season) => <option key={season.id} value={season.id}>
              {season.name} · {season.status}</option>)}
          </select>
        </label>}
      </div>
      <nav className={styles.tabs} aria-label="League sections">
        {TABS.map((item) => <button key={item.id} type="button"
          className={tab === item.id ? styles.selectedTab : ""}
          aria-current={tab === item.id ? "page" : undefined}
          onClick={() => { setTab(item.id); setShowAll(false); setSearch(""); }}>
          {item.label}</button>)}
      </nav>
      {!seasons.length ? <section className={styles.notice}>
        <h2>No published seasons</h2>
        <p>Once this club opens its league, tables and fixtures will appear here.</p>
      </section> : dataState === "loading" ? <section className={styles.notice}
        role="status">Loading {currentSeason?.name || "season"}…</section> :
        dataState === "error" ? <section className={styles.notice} role="alert">
          <h2>Could not load league</h2><p>{dataError}</p>
        </section> : <>
          {tab === "overview" && <>
            <div className={styles.metrics}>
              <article><span>Divisions</span><strong>{data.divisions.length}</strong></article>
              <article><span>Teams</span><strong>{data.teams.length}</strong></article>
              <article><span>Fixtures</span><strong>{data.fixtures.length}</strong></article>
              <article><span>Final results</span><strong>{confirmed}</strong></article>
            </div>
            {content.announcements.length > 0 && <section className={styles.announcements}>
              <span className={styles.kicker}>LATEST CLUB NEWS</span>
              {content.announcements.map((item) => <article key={item.id}>
                <div><h3>{item.title}</h3><span>{dateLabel(item.created_at)}</span></div>
                <p>{item.body}</p>
              </article>)}
            </section>}
            {data.divisions.map((division) => {
              const divisionFixtures = data.fixtures
                .filter((fixture) => fixture.division_id === division.id)
                .sort((a, b) => Number(isConfirmed(results.get(a.id))) -
                  Number(isConfirmed(results.get(b.id))) ||
                  a.play_by.localeCompare(b.play_by)).slice(0, 4);
              return <section className={styles.division} key={division.id}>
                <div className={styles.divisionHeader}>
                  <span className={styles.kicker}>DIVISION {division.sort_order}</span>
                  <h3>{division.name}</h3>
                </div>
                <div className={styles.panels}>
                  <div className={styles.card}><h4>League table</h4>{tableFor(division)}</div>
                  <div className={styles.card}><h4>Latest &amp; upcoming matches</h4>
                    {divisionFixtures.length
                      ? <ul className={styles.fixtures}>{divisionFixtures.map(fixtureRow)}</ul>
                      : <p className={styles.empty}>No published matches yet.</p>}
                  </div>
                </div>
              </section>;
            })}
            {!data.divisions.length && <section className={styles.notice}>
              No divisions have been published for this season.</section>}
          </>}
          {tab !== "overview" && <section className={styles.section}>
            <div className={styles.sectionHeading}><div>
              <span className={styles.kicker}>{currentSeason?.name}</span>
              <h2>{TABS.find((value) => value.id === tab)?.label}</h2>
            </div><span className={styles.sectionCount}>
              {tab === "fixtures" ? data.fixtures.length - confirmed :
                tab === "results" ? confirmed :
                tab === "teams" ? data.teams.length : data.divisions.length}
            </span></div>
            <div className={styles.filterBar}>
              <label>Division
                <select value={divisionFilter}
                  onChange={(event) => { setDivisionFilter(event.target.value); setShowAll(false); }}>
                  <option value="all">All divisions</option>
                  {data.divisions.map((division) => <option key={division.id}
                    value={division.id}>{division.name}</option>)}
                </select>
              </label>
              {(tab === "fixtures" || tab === "results" || tab === "teams") &&
                <label>Search
                  <input type="search" value={search} placeholder="Find a team or match…"
                    onChange={(event) => { setSearch(event.target.value); setShowAll(false); }} />
                </label>}
            </div>
            {(tab === "fixtures" || tab === "results") && <div className={styles.card}>
              {!sortedFixtures.length
                ? <p className={styles.empty}>No matching {tab} for this season.</p>
                : <ul className={styles.fixtures}>{visibleFixtures.map(fixtureRow)}</ul>}
              {!showAll && sortedFixtures.length > visibleFixtures.length &&
                <button type="button" className={styles.more}
                  onClick={() => setShowAll(true)}>
                  Show all {sortedFixtures.length} matches ↓
                </button>}
            </div>}
            {tab === "tables" && filteredDivisions.map((division) =>
              <section className={styles.cardSection} key={division.id}>
                <div className={styles.divisionHeader}><span className={styles.kicker}>
                  DIVISION {division.sort_order}</span><h3>{division.name}</h3></div>
                <div className={styles.card}>{tableFor(division)}</div>
              </section>)}
            {tab === "teams" && <div className={styles.teamGrid}>
              {data.teams.filter((team) => (divisionFilter === "all" ||
                  team.division_id === divisionFilter) &&
                (!search.trim() || [team.name, team.player_one_name, team.player_two_name]
                  .some((value) => value?.toLowerCase().includes(search.toLowerCase()))))
                .map((team) => <article key={team.id} className={styles.teamCard}>
                  <span className={styles.teamIcon}>◉</span>
                  <div><h3>{team.name}</h3>
                    <span>{data.divisions.find((division) =>
                      division.id === team.division_id)?.name}</span>
                    {(team.player_one_name || team.player_two_name) && <p>
                      {[team.player_one_name, team.player_two_name]
                        .filter(Boolean).join(" · ")}</p>}
                  </div>
                </article>)}
            </div>}
            {tab === "cup" && <>
              <p className={styles.sectionIntro}>Qualification places follow the
                rules published by this club for this season.</p>
              {filteredDivisions.map((division) => {
                const rule = data.cupRules.find((entry) =>
                  entry.division_id === division.id);
                if (!rule) return <article key={division.id} className={styles.cardSection}>
                  <h3>{division.name}</h3><p className={styles.empty}>
                    No cup qualification rule published for this division.</p></article>;
                return <article key={division.id} className={styles.cardSection}>
                  <div className={styles.divisionHeader}><span className={styles.kicker}>
                    {rule.qualifier_count} qualification places</span>
                    <h3>{division.name}</h3></div>
                  <div className={styles.card}><ol className={styles.qualifiers}>
                    {standings(division.id).slice(0, rule.qualifier_count)
                      .map((row) => <li key={row.team_id}>
                        <span>{teamLabel(row.team_id, teamNames)}</span>
                        <strong>{row.points} pts</strong>
                      </li>)}
                    {!standings(division.id).length && <li>
                      Standings not published yet.</li>}
                  </ol></div>
                </article>;
              })}
              {data.cupQualifiers.length > 0 && <div className={styles.cardSection}>
                <h3>Organiser-selected qualifiers</h3><div className={styles.card}>
                  <ol className={styles.qualifiers}>
                    {[...data.cupQualifiers].sort((a, b) =>
                      a.seed_position - b.seed_position).map((entry) =>
                      <li key={entry.team_id}><span>
                        {teamLabel(entry.team_id, teamNames)}</span>
                        <strong>Seed {entry.seed_position}</strong></li>)}
                  </ol>
                </div></div>}
            </>}
          </section>}
        </>}
      {content.sponsors.length > 0 && <section className={styles.sponsorSection}>
        <span className={styles.kicker}>PROUDLY SUPPORTED BY</span>
        <h2>Club partners</h2><div className={styles.sponsorGrid}>
          {content.sponsors.map((sponsor) => {
            const url = safeLink(sponsor.website_url);
            return <article className={styles.sponsorCard} key={sponsor.id}>
              <strong>{sponsor.name}</strong><span>{sponsor.sponsor_type || "Club partner"}</span>
              {url && <a href={url} target="_blank"
                rel="noopener noreferrer">Visit partner ↗</a>}
            </article>;
          })}
        </div>
      </section>}
      {club.slug === "gsm-padel" && <section className={styles.notice}>
        <h2>GSM Padel’s full league hub</h2>
        <p>The original GSM experience includes captain submissions and
          established league-management tools.</p>
        <a href="/clubs/gsm-padel">Open full GSM league →</a>
      </section>}
      <footer className={styles.footer}>
        <p>{club.footer_text || "Your club. Your league."}</p>
        <a href="/">Powered by Rallora ↗</a>
      </footer>
    </div>
  </main>;
}
