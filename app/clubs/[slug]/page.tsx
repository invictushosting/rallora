"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import styles from "./club.module.css";

type Club = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
  welcome_title: string | null;
  welcome_text: string | null;
  footer_text: string | null;
};
type Season = {
  id: string;
  club_id: string;
  name: string;
  status: string;
  starts_on: string | null;
  created_at: string;
};
type Division = { id: string; season_id: string; name: string; sort_order: number | null };
type Team = { id: string; division_id: string; name: string };
type Fixture = {
  id: string;
  season_id: string;
  division_id: string;
  home_team_id: string;
  away_team_id: string;
  play_by: string | null;
  week_number: number | null;
  fixture_group_name: string | null;
  status: string;
};
type Result = {
  fixture_id: string;
  home_score: string | null;
  away_score: string | null;
  status: string;
};
type Standing = {
  team_id: string;
  division_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  score_diff: number;
};
type SeasonData = {
  divisions: Division[];
  teams: Team[];
  fixtures: Fixture[];
  results: Result[];
  standings: Standing[];
};
type ClubState =
  | { status: "loading" | "missing" }
  | { status: "error"; message: string }
  | { status: "ready"; club: Club; seasons: Season[] };

const EMPTY: SeasonData = {
  divisions: [], teams: [], fixtures: [], results: [], standings: [],
};

function displayDate(value: string | null) {
  if (!value) return "Date to arrange";
  const date = new Date(value + "T12:00:00Z");
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(date);
}

function safeBrandColor(color: string | null) {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#2458ff";
}

export default function ClubLeagueHub() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const supabase = useMemo(() => createClient(), []);
  const [clubState, setClubState] = useState<ClubState>({ status: "loading" });
  const [selectedSeason, setSelectedSeason] = useState("");
  const [data, setData] = useState<SeasonData>(EMPTY);
  const [dataStatus, setDataStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dataError, setDataError] = useState("");

  useEffect(() => {
    let alive = true;
    setClubState({ status: "loading" });
    setSelectedSeason("");
    setData(EMPTY);

    async function loadClub() {
      try {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          if (alive) setClubState({ status: "missing" });
          return;
        }
        // Resolve the URL slug to a club ID before reading any league rows.
        const { data: club, error: clubError } = await supabase
          .from("clubs")
          .select("id,slug,name,short_name,primary_color,welcome_title,welcome_text,footer_text")
          .eq("slug", slug).eq("is_active", true).maybeSingle();
        if (clubError) throw clubError;
        if (!club) {
          if (alive) setClubState({ status: "missing" });
          return;
        }
        const { data: seasons, error: seasonError } = await supabase
          .from("seasons")
          .select("id,club_id,name,status,starts_on,created_at")
          .eq("club_id", club.id).order("created_at", { ascending: false });
        if (seasonError) throw seasonError;
        // An unrecognised season ID must never become a global season query.
        const clubSeasons = ((seasons ?? []) as Season[])
          .filter((season) => season.club_id === club.id)
          .sort((a, b) => Number(b.status === "active") - Number(a.status === "active"));
        if (alive) {
          setClubState({ status: "ready", club: club as Club, seasons: clubSeasons });
          setSelectedSeason(clubSeasons[0]?.id ?? "");
        }
      } catch (error) {
        if (alive) setClubState({
          status: "error",
          message: error instanceof Error ? error.message : "The club could not be loaded.",
        });
      }
    }
    void loadClub();
    return () => { alive = false; };
  }, [slug, supabase]);

  useEffect(() => {
    if (clubState.status !== "ready" || !selectedSeason) {
      setData(EMPTY);
      return;
    }
    // Cross-club season IDs cannot be selected, even if provided by a forged UI event.
    const season = clubState.seasons.find(
      (item) => item.id === selectedSeason && item.club_id === clubState.club.id,
    );
    if (!season) {
      setData(EMPTY);
      setDataStatus("error");
      setDataError("This season does not belong to the selected club.");
      return;
    }
    let alive = true;
    setData(EMPTY);
    setDataStatus("loading");
    setDataError("");

    async function loadSeason() {
      try {
        const [divisionReply, fixtureReply, standingReply] = await Promise.all([
          supabase.from("divisions").select("id,season_id,name,sort_order")
            .eq("season_id", season.id).order("sort_order", { ascending: true }),
          supabase.from("fixtures")
            .select("id,season_id,division_id,home_team_id,away_team_id,play_by,week_number,fixture_group_name,status")
            .eq("season_id", season.id).order("play_by", { ascending: true }),
          supabase.from("standings")
            .select("team_id,division_id,played,won,drawn,lost,points,score_diff")
            .eq("season_id", season.id),
        ]);
        if (divisionReply.error) throw divisionReply.error;
        if (fixtureReply.error) throw fixtureReply.error;
        if (standingReply.error) throw standingReply.error;

        const divisions = ((divisionReply.data ?? []) as Division[])
          .filter((division) => division.season_id === season.id);
        const divisionIds = divisions.map((division) => division.id);
        const fixtures = ((fixtureReply.data ?? []) as Fixture[])
          .filter((fixture) =>
            fixture.season_id === season.id && divisionIds.includes(fixture.division_id),
          );
        const fixtureIds = fixtures.map((fixture) => fixture.id);
        // Never run an unfiltered .in() query when a club has no divisions or fixtures.
        const [teamReply, resultReply] = await Promise.all([
          divisionIds.length
            ? supabase.from("teams").select("id,division_id,name")
                .in("division_id", divisionIds).eq("is_active", true)
            : Promise.resolve({ data: [] as Team[], error: null }),
          fixtureIds.length
            ? supabase.from("results").select("fixture_id,home_score,away_score,status")
                .in("fixture_id", fixtureIds)
            : Promise.resolve({ data: [] as Result[], error: null }),
        ]);
        if (teamReply.error) throw teamReply.error;
        if (resultReply.error) throw resultReply.error;

        const teamIds = new Set(((teamReply.data ?? []) as Team[]).map((team) => team.id));
        if (alive) {
          setData({
            divisions,
            teams: (teamReply.data ?? []) as Team[],
            fixtures,
            results: (resultReply.data ?? []) as Result[],
            standings: ((standingReply.data ?? []) as Standing[])
              .filter((row) => divisionIds.includes(row.division_id) && teamIds.has(row.team_id)),
          });
          setDataStatus("ready");
        }
      } catch (error) {
        if (alive) {
          setDataStatus("error");
          setDataError(error instanceof Error ? error.message : "Season data could not be loaded.");
        }
      }
    }
    void loadSeason();
    return () => { alive = false; };
  }, [clubState, selectedSeason, supabase]);

  if (clubState.status === "loading") {
    return <main className={styles.page}><p className={styles.center}>Loading club…</p></main>;
  }
  if (clubState.status === "missing") {
    return <main className={styles.page}><div className={styles.center}>
      <h1>Club not found</h1><p>This club does not exist or is not currently public.</p>
      <a href="/">Back to Rallora</a>
    </div></main>;
  }
  if (clubState.status === "error") {
    return <main className={styles.page}><div className={styles.center} role="alert">
      <h1>Unable to load club</h1><p>{clubState.message}</p>
      <a href="/">Back to Rallora</a>
    </div></main>;
  }

  const { club, seasons } = clubState;
  const brand = safeBrandColor(club.primary_color);
  const selected = seasons.find((season) => season.id === selectedSeason);
  const teamNames = new Map(data.teams.map((team) => [team.id, team.name]));
  const results = new Map(data.results.map((result) => [result.fixture_id, result]));
  const confirmedCount = data.fixtures.filter((fixture) =>
    results.get(fixture.id)?.status === "confirmed",
  ).length;

  return <main className={styles.page} style={{ "--club-color": brand } as React.CSSProperties}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <a href="/" className={styles.brand} aria-label="Rallora home"><span>R</span> Rallora</a>
        <span className={styles.readOnly}>CLUB LEAGUE HUB · READ-ONLY</span>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>{club.short_name ?? "PADEL"} · CLUB LEAGUE</span>
        <h1>{club.name}</h1>
        <p>{club.welcome_text || "Fixtures, teams and league standings in one place."}</p>
        <div className={styles.heroFooter}>
          <span>{club.welcome_title || "Your league hub"}</span>
          <span>Powered by Rallora</span>
        </div>
      </section>

      <section className={styles.toolbar} aria-label="Choose a club season">
        <div>
          <span className={styles.kicker}>CURRENT VIEW</span>
          <h2>League overview</h2>
        </div>
        {seasons.length > 0 && <label className={styles.seasonPicker}>
          <span>Season</span>
          <select value={selectedSeason} onChange={(event) => setSelectedSeason(event.target.value)}>
            {seasons.map((season) =>
              <option key={season.id} value={season.id}>{season.name} · {season.status}</option>,
            )}
          </select>
        </label>}
      </section>

      {!seasons.length ? <section className={styles.notice}>
        <h2>No seasons yet</h2><p>This club has not published a league season.</p>
      </section> : dataStatus === "loading" ? <section className={styles.notice} role="status">
        Loading {selected?.name ?? "season"}…
      </section> : dataStatus === "error" ? <section className={styles.notice} role="alert">
        <h2>Could not load season</h2><p>{dataError}</p>
      </section> : <>
        <div className={styles.metrics}>
          <article><span>Divisions</span><strong>{data.divisions.length}</strong></article>
          <article><span>Teams</span><strong>{data.teams.length}</strong></article>
          <article><span>Fixtures</span><strong>{data.fixtures.length}</strong></article>
          <article><span>Confirmed results</span><strong>{confirmedCount}</strong></article>
        </div>

        {data.divisions.map((division) => {
          const table = data.standings
            .filter((row) => row.division_id === division.id)
            .sort((a, b) => b.points - a.points || b.score_diff - a.score_diff ||
              (teamNames.get(a.team_id) ?? "").localeCompare(teamNames.get(b.team_id) ?? ""));
          const divisionFixtures = data.fixtures
            .filter((fixture) => fixture.division_id === division.id)
            .sort((a, b) => Number(Boolean(results.get(a.id))) - Number(Boolean(results.get(b.id))) ||
              (a.play_by ?? "").localeCompare(b.play_by ?? ""))
            .slice(0, 6);
          return <section className={styles.division} key={division.id}>
            <div className={styles.divisionHeader}>
              <span className={styles.kicker}>DIVISION {division.sort_order ?? ""}</span>
              <h3>{division.name}</h3>
            </div>
            <div className={styles.panels}>
              <div className={styles.card}>
                <h4>League table</h4>
                {!table.length ? <p className={styles.empty}>No standings published yet.</p> :
                  <div className={styles.tableWrap}><table>
                    <thead><tr><th scope="col">#</th><th scope="col">Team</th>
                      <th scope="col">P</th><th scope="col">W</th>
                      <th scope="col">D</th><th scope="col">L</th>
                      <th scope="col">Pts</th></tr></thead>
                    <tbody>{table.map((row, index) =>
                      <tr key={row.team_id}><td>{index + 1}</td>
                        <th scope="row">{teamNames.get(row.team_id) ?? "Team"}</th>
                        <td>{row.played}</td><td>{row.won}</td>
                        <td>{row.drawn}</td><td>{row.lost}</td>
                        <td className={styles.points}>{row.points}</td></tr>)}</tbody>
                  </table></div>}
              </div>
              <div className={styles.card}>
                <h4>Fixtures and results</h4>
                {!divisionFixtures.length ? <p className={styles.empty}>No fixtures published yet.</p> :
                  <ul className={styles.fixtures}>{divisionFixtures.map((fixture) => {
                    const result = results.get(fixture.id);
                    return <li key={fixture.id}>
                      <div className={styles.fixtureTop}>
                        <span>{fixture.fixture_group_name || (fixture.week_number ? `Week ${fixture.week_number}` : "Fixture")}</span>
                        <span>{displayDate(fixture.play_by)}</span>
                      </div>
                      <div className={styles.match}>
                        <strong>{teamNames.get(fixture.home_team_id) ?? "Home team"}</strong>
                        <span className={styles.score}>{result
                          ? `${result.home_score ?? "–"} : ${result.away_score ?? "–"}`
                          : "vs"}</span>
                        <strong>{teamNames.get(fixture.away_team_id) ?? "Away team"}</strong>
                      </div>
                      <span className={styles.fixtureStatus}>{result?.status ?? fixture.status}</span>
                    </li>;
                  })}</ul>}
              </div>
            </div>
          </section>;
        })}
        {!data.divisions.length && <section className={styles.notice}>
          <h2>No divisions yet</h2><p>Divisions will appear when the club sets up this season.</p>
        </section>}
      </>}

      <footer className={styles.footer}>
        <p>{club.footer_text || "Your club. Your league."}</p><p>Powered by Rallora</p>
      </footer>
    </div>
  </main>;
}
