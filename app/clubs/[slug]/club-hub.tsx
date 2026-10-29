"use client";

import {fixturePlayerLabel} from "@/lib/fixture-rosters";
import {fixtureMatchesQuery} from "@/lib/leagues/fixture-discovery";
import {registrationWindowState} from "@/lib/registration-window";
import {useRegistrationWindow} from "@/lib/hooks/use-registration-window";
import BackLink from "@/app/components/back-link";
import {brandColor, readableInk, readableAccent} from "@/lib/brand-colors";
import RalloraLogo from "@/app/components/rallora-logo";
import Loading from "@/app/loading";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import styles from "./club.module.css";
import ClubSponsors from "@/app/components/club-sponsors";
import ClubFooter from "@/app/components/club-footer";
import { SPONSOR_FIELDS, type Sponsor } from "@/lib/sponsors";
import {scoreSets} from "@/lib/leagues/scores";
import {
  makeFixtureDeadlineIcs, makeResultsCsv, type ExportFixture,
} from "@/lib/leagues/exports";

type Club = {
  id: string; slug: string; name: string; short_name: string | null;
  primary_color: string | null; secondary_color: string | null; accent_color: string | null;
  welcome_title: string | null;
  welcome_text: string | null; footer_text: string | null;
  contact_email: string | null; website_url: string | null; sponsor_enquiries_enabled: boolean;
  logo_url: string | null; cover_image_url: string | null; booking_url: string | null;
};
type Season = {
  id: string; club_id: string; name: string; status: string;
  starts_on: string | null; created_at: string; registration_published:boolean; registration_opens_at:string|null; registration_closes_at:string|null;
};
type Division = { id: string; season_id: string; name: string; sort_order: number };
type Team = {
  id: string; division_id: string; name: string;
  player_one_name: string | null; player_two_name: string | null;
  player_one_rating: number | null; player_two_rating: number | null;
  player_one_rating_source: string | null; player_two_rating_source: string | null;
};
type Fixture = {
  id: string; season_id: string; division_id: string;
  home_team_id: string; away_team_id: string;
  play_by: string; week_number: number;
  home_player_names:(string|null)[]|null;away_player_names:(string|null)[]|null;
  fixture_group_name: string | null; status: string; court: string | null;
  available_from: string | null;
  arrangement_status: "not_arranged" | "possible" | "arranged" | "in_progress" | "result_required" | "cancelled";
  booking_starts_at: string | null; booking_ends_at: string | null;
  booking_type: string | null; booking_court: string | null; booking_matched_players: number | null;
};
type Result = {
  fixture_id: string; home_score: string | null;
  away_score: string | null; status: string; confirmed_at: string | null;
};
type Standing = {
  team_id: string; division_id: string; played: number; won: number;
  drawn: number; lost: number; points: number; score_diff: number;
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
  { id: "teams", label: "Players" }, { id: "cup", label: "League cup" },
];
const EMPTY: LeagueData = {
  divisions: [], teams: [], fixtures: [], results: [], standings: [],
  cupRules: [], cupQualifiers: [],
};
function safeColor(color: string | null) {
  return brandColor(color);
}
function safeImage(url: string | null) {
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try { const parsed = new URL(url); return parsed.protocol === "https:" ? parsed.href : null; }
  catch { return null; }
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
  return names.get(id) ?? "Players unavailable";
}
function playerNames(team: Team | undefined) {
  return team
    ? [team.player_one_name, team.player_two_name].filter((name): name is string => Boolean(name?.trim())).map(name => name.trim())
    : [];
}
function playerPair(team: Team) {
  return playerNames(team).join(" / ") || "Players to be confirmed";
}

export default function ClubLeagueHub({ slugOverride, previewSeasonId }: { slugOverride?: string; previewSeasonId?: string } = {}) {
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
  const [exportNotice, setExportNotice] = useState("");

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
          .select("id,slug,name,short_name,primary_color,secondary_color,accent_color,welcome_title,welcome_text,footer_text,logo_url,cover_image_url,booking_url,contact_email,website_url,sponsor_enquiries_enabled")
          .eq("slug", slug).eq("is_active", true).maybeSingle();
        if (clubError) throw clubError;
        if (!club) {
          if (alive) setClubState({ kind: "missing" });
          return;
        }
        if (previewSeasonId) {
          const { data: access, error: accessError } = await supabase.rpc("rallora_can_manage_club", { p_club_id: club.id });
          if (accessError || !access) throw new Error("Sign in as a club administrator to preview this competition.");
        }
        const seasonQuery = supabase.from("seasons")
          .select("id,club_id,name,status,starts_on,created_at,registration_published,registration_opens_at,registration_closes_at")
          .eq("club_id", club.id);
        const [seasonsReply, sponsorsReply, announcementsReply] = await Promise.all([
          (previewSeasonId
            ? seasonQuery.eq("id", previewSeasonId)
            : seasonQuery.or("status.in.(active,completed),and(status.eq.draft,registration_published.eq.true)"))
            .order("created_at", { ascending: false }),
          supabase.from("sponsors")
            .select(SPONSOR_FIELDS)
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
            (previewSeasonId ? season.id === previewSeasonId : (["active", "completed"].includes(season.status) || (season.status==="draft" && season.registration_published))))
          .sort((a, b) => Number(b.status === "active") -
            Number(a.status === "active"));
        if (previewSeasonId && seasons.length !== 1) throw new Error("This competition could not be previewed for this club.");
        if (alive) {
          setClubState({
            kind: "ready", club: club as Club, seasons,
            content: {
              sponsors: (sponsorsReply.data ?? []) as Sponsor[],
              announcements: (announcementsReply.data ?? []) as Announcement[],
            },
          });
          const query = new URLSearchParams(window.location.search);
          const linkedSeason = query.get("season");
          const linkedView = query.get("view");
          setSeasonId(seasons.find(value => value.id === linkedSeason)?.id ??
            seasons[0]?.id ?? "");
          setTab(TABS.find(value => value.id === linkedView)?.id ?? "overview");
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
  }, [slug, supabase, previewSeasonId]);

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
        const fixtureQuery = supabase.from("fixtures")
          .select("id,season_id,division_id,home_team_id,away_team_id,play_by,week_number,home_player_names,away_player_names,fixture_group_name,status,court,available_from,arrangement_status,booking_starts_at,booking_ends_at,booking_type,booking_court,booking_matched_players")
          .eq("season_id", verifiedSeasonId);
        const [divisionReply, fixtureReply, standingReply, cupReply, manualReply] =
          await Promise.all([
            supabase.from("divisions")
              .select("id,season_id,name,sort_order")
              .eq("season_id", verifiedSeasonId).order("sort_order", { ascending: true }),
            (previewSeasonId ? fixtureQuery : fixtureQuery.or(`available_from.is.null,available_from.lte.${today}`))
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
            (Boolean(previewSeasonId) || !fixture.available_from || fixture.available_from <= today));
        const fixtureIds = fixtures.map((fixture) => fixture.id);
        const [teamsReply, resultReply] = await Promise.all([
          divisionIds.size
            ? supabase.from("teams")
              .select("id,division_id,name,player_one_name,player_two_name,player_one_rating,player_two_rating,player_one_rating_source,player_two_rating_source")
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
          const query = new URLSearchParams(window.location.search);
          const linkedDivision = query.get("division");
          const linkedSearch = query.get("q");
          setDivisionFilter(divisions.find(d => d.id === linkedDivision)?.id ?? "all");
          setSearch(linkedSearch?.slice(0, 80) ?? "");
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
  }, [clubState, seasonId, supabase, previewSeasonId]);

  const selectedRegistrationSeason=clubState.kind==="ready"?clubState.seasons.find(season=>season.id===seasonId):null;
  const registrationState=useRegistrationWindow(selectedRegistrationSeason);

  if (clubState.kind === "loading") return <Loading />;

  if (clubState.kind !== "ready") {
    const message =
      clubState.kind === "missing" ? "This club is not publicly available." :
      clubState.message;
    return <main className={styles.page}><div className={styles.center}
      role={clubState.kind === "error" ? "alert" : "status"}>
      <span className={styles.brand}><RalloraLogo variant="light" width={210} /></span>
      <h1>{clubState.kind === "missing" ? "Club not found" : "Could not load club"}</h1>
      <p>{message}</p><Link href="/">Back to Rallora →</Link>
    </div></main>;
  }

  const { club, seasons, content } = clubState;
  const currentSeason = seasons.find((season) => season.id === seasonId);
  const registrationOpen = Boolean(currentSeason?.status === "draft" && registrationState === "open");
  const registrationDeadline = currentSeason?.registration_closes_at ? dateLabel(currentSeason.registration_closes_at) : null;
  const clubLogo = safeImage(club.logo_url);
  const clubCover = safeImage(club.cover_image_url);
  const teamNames = new Map(data.teams.map((team) => [team.id, playerPair(team)]));
  const teamLabelsById = new Map(data.teams.map((team) => [team.id, team.name] as const));
  const results = new Map(data.results.map((result) => [result.fixture_id, result]));
  const standings = (id: string) => data.standings
    .filter((row) => row.division_id === id)
    .sort((a, b) => b.points - a.points || b.score_diff - a.score_diff ||
      teamLabel(a.team_id, teamNames).localeCompare(teamLabel(b.team_id, teamNames)));
  const confirmed = data.fixtures.filter((fixture) =>
    isConfirmed(results.get(fixture.id))).length;
  const availableFixturesForTab = data.fixtures.filter((fixture) =>
    tab === "results" ? isConfirmed(results.get(fixture.id)) :
      !isConfirmed(results.get(fixture.id)));
  const fixtureCountsByDivision = new Map(data.divisions.map((division) =>
    [division.id, availableFixturesForTab.filter((fixture) =>
      fixture.division_id === division.id).length] as const));
  const divisionNames = new Map(data.divisions.map((division) =>
    [division.id, division.name] as const));
  const divisionOrder = new Map(data.divisions.map((division) =>
    [division.id, division.sort_order] as const));
  const fixturesForTab = availableFixturesForTab
    .filter((fixture) => divisionFilter === "all" ||
      fixture.division_id === divisionFilter)
    .filter((fixture) => fixtureMatchesQuery(search, [
      divisionNames.get(fixture.division_id),
      teamNames.get(fixture.home_team_id),
      teamNames.get(fixture.away_team_id),
      teamLabelsById.get(fixture.home_team_id),
      teamLabelsById.get(fixture.away_team_id),
      fixturePlayerLabel(fixture, fixture.home_team_id, teamNames.get(fixture.home_team_id) ?? "Players"),
      fixturePlayerLabel(fixture, fixture.away_team_id, teamNames.get(fixture.away_team_id) ?? "Players"),
      fixture.fixture_group_name, fixture.court, fixture.booking_court,
      `Round ${fixture.week_number}`, `Week ${fixture.week_number}`,
    ]));
  const sortedFixtures = [...fixturesForTab].sort((a, b) =>
    (divisionFilter === "all" ?
      (divisionOrder.get(a.division_id) ?? 999) - (divisionOrder.get(b.division_id) ?? 999) : 0) ||
    (tab === "results" ? b.play_by.localeCompare(a.play_by) : a.play_by.localeCompare(b.play_by)) ||
    a.id.localeCompare(b.id));
  const visibleFixtures = showAll ? sortedFixtures : sortedFixtures.slice(0, 18);
  const filteredDivisions = data.divisions.filter((division) =>
    divisionFilter === "all" || division.id === divisionFilter);

  function bookingLabel(value: string | null) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", {
      weekday:"short", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit",
    }).format(date);
  }
  function bookingDuration(start: string | null, end: string | null) {
    if (!start || !end) return "";
    const minutes = Math.round((new Date(end).getTime()-new Date(start).getTime())/60000);
    return minutes > 0 ? `${minutes} mins` : "";
  }
  function arrangementPanel(fixture: Fixture) {
    const status = fixture.booking_type==="MANUAL" && fixture.booking_ends_at && new Date(fixture.booking_ends_at)<new Date() ? "result_required"
      : fixture.booking_type==="MANUAL" && fixture.booking_starts_at && new Date(fixture.booking_starts_at)<new Date() ? "in_progress" : fixture.arrangement_status || "not_arranged";
    const arranged = ["arranged","in_progress","result_required"].includes(status);
    const title = status==="possible" ? "Possible booking found" : status==="cancelled" ? "Booking cancelled" :
      status==="result_required" ? "Match played · result required" : status==="in_progress" ? "Match in progress" :
      arranged ? "Match arranged" : "Match not arranged";
    const detail = arranged || status==="possible"
      ? [bookingLabel(fixture.booking_starts_at), fixture.booking_court, bookingDuration(fixture.booking_starts_at,fixture.booking_ends_at)].filter(Boolean).join(" · ")
      : status==="cancelled" ? "This fixture needs rearranging" : `No matching Playtomic booking detected · Play by ${dateLabel(fixture.play_by)}`;
    const meta = status==="possible" ? `${fixture.booking_matched_players ?? 0}/4 players matched · Club review required` :
      arranged && fixture.booking_type==="MANUAL" ? "Agreed booking recorded by a captain" :
      arranged ? `${fixture.booking_type==="OPEN_MATCH" ? "Open Match" : "Playtomic booking"} · ${fixture.booking_matched_players ?? 4}/4 players matched` :
      status==="cancelled" ? "Arrange another match in Playtomic" : "Arrange your match in Playtomic";
    const bookingUrl = safeLink(club.booking_url);
    const needsBooking = status === "not_arranged" || status === "cancelled";
    return <div className={`${styles.arrangementBox} ${styles["arrangement_"+status]}`}>
      <span className={styles.arrangementDot} aria-hidden="true" />
      <div className={styles.arrangementContent}>
        <strong>{title}</strong><span>{detail}</span><small>{meta}</small>
        {needsBooking && bookingUrl && <a className={styles.bookingAction} href={bookingUrl}
          target="_blank" rel="noopener noreferrer">{status === "cancelled" ? "Rebook court ↗" : "Book court ↗"}</a>}
      </div>
    </div>;
  }
  function fixtureRow(fixture: Fixture) {
    const result = results.get(fixture.id);
    const resolved = isConfirmed(result);
    const homePlayers = fixture.home_player_names?.filter((name): name is string=>Boolean(name?.trim())) ?? playerNames(data.teams.find(team => team.id === fixture.home_team_id));
    const awayPlayers = fixture.away_player_names?.filter((name): name is string=>Boolean(name?.trim())) ?? playerNames(data.teams.find(team => team.id === fixture.away_team_id));
    return <li key={fixture.id} className={styles.fixture}>
      <div className={styles.fixtureTop}>
        <span>{data.divisions.find((division) =>
          division.id === fixture.division_id)?.name ?? "Division"}</span>
        <span>{fixture.fixture_group_name ||
          (fixture.week_number ? `Week ${fixture.week_number}` : "League fixture")}</span>
        <span>{dateLabel(fixture.play_by)}</span>
      </div>
      {resolved ? <div className={styles.resultCard}>
        <div className={styles.resultPair}><span className={styles.pairSide}>HOME</span><strong>{fixturePlayerLabel(fixture,fixture.home_team_id,teamLabel(fixture.home_team_id, teamNames))}</strong></div>
        <div className={styles.setScore}>
          <div className={styles.setHeaders}>{scoreSets(result?.home_score).map((_, index)=><span key={index}>SET {index + 1}</span>)}</div>
          <div className={styles.setRow}>{scoreSets(result?.home_score).map((score,index)=>{const away=Number(scoreSets(result?.away_score)[index]);const home=Number(score);return <strong key={index} className={home>away?styles.setWon:""}>{score}</strong>;})}</div>
          <div className={styles.setRow}>{scoreSets(result?.away_score).map((score,index)=>{const home=Number(scoreSets(result?.home_score)[index]);const away=Number(score);return <strong key={index} className={away>home?styles.setWon:""}>{score}</strong>;})}</div>
        </div>
        <div className={`${styles.resultPair} ${styles.resultPairAway}`}><span className={styles.pairSide}>AWAY</span><strong>{fixturePlayerLabel(fixture,fixture.away_team_id,teamLabel(fixture.away_team_id, teamNames))}</strong></div>
      </div> : <div className={styles.match}>
        <div className={styles.matchTeam}>{homePlayers.length ? homePlayers.map((name, index)=><strong key={index}>{name}</strong>) : <strong>Players to be confirmed</strong>}</div>
        <span className={styles.score}>vs</span>
        <div className={styles.matchTeam}>{awayPlayers.length ? awayPlayers.map((name, index)=><strong key={index}>{name}</strong>) : <strong>Players to be confirmed</strong>}</div>
      </div>}
      {!resolved && arrangementPanel(fixture)}
      {(resolved || fixture.status === "disputed") && <div className={styles.fixtureBottom}>
        <span>{resolved ? (fixture.booking_court || fixture.court || "Match complete") : "Result under review"}</span>
        <span className={resolved ? styles.confirmed : styles.fixtureStatus}>
          {resolved ? "Final" : "Under review"}
        </span>
      </div>}
    </li>;
  }
  async function copyViewLink() {
    const link = new URL(window.location.href);
    const params = new URLSearchParams();
    if (tab !== "overview") params.set("view", tab);
    if (seasonId) params.set("season", seasonId);
    if (divisionFilter !== "all") params.set("division", divisionFilter);
    if (search.trim()) params.set("q", search.trim().slice(0, 80));
    link.search = params.toString();
    link.hash = "";
    try {
      await navigator.clipboard.writeText(link.href);
      setExportNotice("Shareable link copied for this season, section and filters.");
    } catch {
      setExportNotice("Select and copy this link: " + link.href);
    }
  }

  function publicFixture(fixture: Fixture): ExportFixture {
    const result = results.get(fixture.id);
    const division = data.divisions.find((value) =>
      value.id === fixture.division_id);
    return {
      id: fixture.id,
      division: division?.name ?? "Division",
      home: fixturePlayerLabel(fixture,fixture.home_team_id,teamLabel(fixture.home_team_id, teamNames)),
      away: fixturePlayerLabel(fixture,fixture.away_team_id,teamLabel(fixture.away_team_id, teamNames)),
      playBy: fixture.play_by.slice(0, 10),
      week: fixture.week_number,
      court: fixture.court,
      ...(isConfirmed(result)
        ? { score: `${result?.home_score ?? "–"} : ${result?.away_score ?? "–"}` }
        : {}),
    };
  }

  function download(content: string, filename: string, mediaType: string) {
    try {
      const object = URL.createObjectURL(new Blob([content], { type: mediaType }));
      const anchor = document.createElement("a");
      anchor.href = object;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(object), 5000);
      setExportNotice("Download prepared from this club’s visible published matches.");
    } catch {
      setExportNotice("Download unavailable on this device. Try another browser.");
    }
  }

  function exportFilteredMatches() {
    if (!currentSeason || !sortedFixtures.length) return;
    const matches = sortedFixtures.map(publicFixture);
    const prefix = `rallora-${slug}-${currentSeason.id}`;
    if (tab === "results") {
      download(makeResultsCsv(club.name, currentSeason.name, matches),
        `${prefix}-results.csv`, "text/csv;charset=utf-8");
    } else if (tab === "fixtures") {
      download(makeFixtureDeadlineIcs(club.name, currentSeason.name,
        club.slug, window.location.origin, matches),
        `${prefix}-deadlines.ics`, "text/calendar;charset=utf-8");
    }
  }

  function tableFor(division: Division) {
    const rows = standings(division.id);
    return <div className={styles.tableWrap}><table>
      <thead><tr><th scope="col">#</th><th scope="col">Players</th>
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
    style={{ "--club-color": safeColor(club.primary_color), "--club-secondary": brandColor(club.secondary_color,"#061a39"), "--club-accent": safeColor(club.accent_color || club.primary_color), "--club-bg": `color-mix(in srgb, ${safeColor(club.primary_color)} 5%, #f7f8fa)`, "--club-ink": "#061a39", "--club-secondary-ink": readableInk(brandColor(club.secondary_color,"#061a39")), "--club-primary-ink": readableInk(safeColor(club.primary_color)), "--club-hero-accent": readableAccent(safeColor(club.accent_color || club.primary_color),brandColor(club.secondary_color,"#061a39")) } as React.CSSProperties}>
    <div className={styles.shell}>
      {previewSeasonId && <aside role="status"><strong>Private competition preview</strong><p>Visible only to authorised club administrators. This does not publish the competition.</p><BackLink href={`/clubs/${encodeURIComponent(slug)}/admin`}>Back to club admin</BackLink></aside>}
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Rallora home">
          <RalloraLogo variant="light" width={210} /></Link>
        <div className={styles.headerLinks}>
          <Link href="/" className={styles.adminLink}>Rallora home</Link>
          {registrationOpen?<Link href={`/clubs/${encodeURIComponent(slug)}/register?season=${encodeURIComponent(currentSeason!.id)}`} className={styles.registerLink}>Register</Link>:<a href="#league-centre" className={styles.registerLink}>Competitions</a>}
          <Link href={`/clubs/${encodeURIComponent(slug)}/captain`} className={styles.adminLink}>Captain login</Link>
          <Link href={`/clubs/${encodeURIComponent(slug)}/admin`} className={styles.adminLink}>Club admin</Link>
        </div>
      </header>
      <section className={`${styles.hero} ${clubCover ? styles.heroWithCover : ""}`}
        style={clubCover ? { "--club-cover": `url("${clubCover.replace(/["\\]/g, "")}")` } as React.CSSProperties : undefined}>
        <div className={styles.clubIdentity}>
          {clubLogo && <span className={styles.heroLogo}><img src={clubLogo} alt={`${club.name} logo`} /></span>}
          <div><span className={styles.eyebrow}>{club.short_name || "PADEL"} · LEAGUE HUB</span>
            <h1>{club.name}</h1></div>
        </div>
        <p>{club.welcome_text || "Fixtures, results and league tables. All in one place."}</p>
        {seasons.length > 1 && <div className={styles.heroLeagueChooser}>
            <label htmlFor="hero-league-choice"><span aria-hidden="true">▦</span> Choose your league <small>{seasons.length} available</small></label>
            <div className={styles.heroSelectWrap}><select id="hero-league-choice" value={seasonId} onChange={event => setSeasonId(event.target.value)}>{seasons.map(season => <option key={season.id} value={season.id}>{season.name}</option>)}</select><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <p>Select a league to see its registration, tables and fixtures.</p>
          </div>}
        {currentSeason?.status==="draft" && currentSeason.registration_published && <div className={styles.registrationCallout}>
          <div><span className={`${styles.statusPill} ${registrationOpen?"":styles.registrationUnavailable}`}>{registrationOpen?"Registration open":registrationState==="upcoming"?"Registration opens soon":"Registration closed"}</span>
            <strong>{currentSeason.name}</strong>
            {registrationState==="upcoming"&&currentSeason.registration_opens_at?<small>Entries open {dateLabel(currentSeason.registration_opens_at)}</small>:registrationDeadline&&<small>Entries {registrationOpen?"close":"closed"} {registrationDeadline}</small>}</div>
          {registrationOpen?<Link href={`/clubs/${encodeURIComponent(slug)}/register?season=${encodeURIComponent(currentSeason.id)}`}>Register now</Link>:<small>{registrationState==="upcoming"?"Please return when registration opens.":"Entries are closed. Existing players can still claim their invitation and sign in."}</small>}
        </div>}
        <div className={styles.heroActions}>
          {!registrationOpen && <a href="#league-centre">View competition</a>}
          <Link href={`/clubs/${encodeURIComponent(slug)}/events`}>Club events</Link>
          <Link href="/notifications">League updates</Link>
        </div>
        <div className={`${styles.heroFooter} ${styles.heroLeagueNavigation}`}>
          <span>{currentSeason?.name ?? club.welcome_title ?? "Club league"}</span>
          <a className={styles.scrollToLeague} href="#league-centre">View league centre <span aria-hidden="true">↓</span></a>
        </div>
      </section>
      <ClubSponsors sponsors={content.sponsors} context={{clubId:club.id,seasonId}} position="after-header" />
      <div className={styles.toolbar} id="league-centre">
        <div><span className={styles.kicker}>YOUR CLUB. YOUR LEAGUE.</span>
          <h2>League centre</h2></div>
        {seasons.length > 0 && <label className={styles.seasonPicker}>
          <span>Choose league</span>
          <select value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>
            {seasons.map((season) => <option key={season.id} value={season.id}>
              {season.name} · {season.status === "draft" && season.registration_published ? registrationWindowState(season)==="open"?"Registration open":registrationWindowState(season)==="upcoming"?"Registration opens soon":"Registration closed" : season.status}</option>)}
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
      <ClubSponsors sponsors={content.sponsors} context={{clubId:club.id,seasonId}} position="above-tables" enquiry={currentSeason ? {enabled:club.sponsor_enquiries_enabled,email:club.contact_email,name:currentSeason.name} : undefined} />
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
              <article><span>Player pairs</span><strong>{data.teams.length}</strong></article>
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
                  <h3>{division.name}</h3>
                </div>
                <ClubSponsors sponsors={content.sponsors.filter(item => item.scope_type === "division")} context={{clubId:club.id,seasonId,divisionId:division.id}} position="after-header" />
                <div className={styles.panels}>
                  <div><ClubSponsors sponsors={content.sponsors.filter(item => item.scope_type === "division")} context={{clubId:club.id,seasonId,divisionId:division.id}} position="above-tables" /><div className={styles.card}><h4>League table</h4>{tableFor(division)}</div><ClubSponsors sponsors={content.sponsors} context={{clubId:club.id,seasonId,divisionId:division.id}} position="beside-fixtures" /></div>
                  <div className={styles.card}><h4>Latest &amp; upcoming matches</h4>
                    {divisionFixtures.length
                      ? <ul className={styles.fixtures}>{divisionFixtures.map(fixtureRow)}</ul>
                      : <p className={styles.empty}>No published matches yet.</p>}
                  </div>
                </div>
                <ClubSponsors sponsors={content.sponsors.filter(item => item.scope_type === "division")} context={{clubId:club.id,seasonId,divisionId:division.id}} position="above-footer" />
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
            {(tab === "fixtures" || tab === "results") ? (
              <div className={styles.fixtureDiscovery}>
                <div className={styles.fixtureDiscoveryHeading}>
                  <div><h3>Find your {tab === "results" ? "results" : "fixtures"}</h3>
                    <p>Choose a division below, or search for a player, team or round.</p></div>
                </div>
                <div className={styles.fixtureDivisionHeading}>
                  <strong>Browse by division</strong><span>{data.divisions.length} divisions</span>
                </div>
                <div className={styles.fixtureDivisionGrid} role="group" aria-label="Filter matches by division">
                  <button type="button" className={divisionFilter === "all" ? styles.fixtureDivisionSelected : styles.fixtureDivisionButton}
                    aria-pressed={divisionFilter === "all"}
                    onClick={() => { setDivisionFilter("all"); setShowAll(false); }}>
                    <span>All divisions</span><small>{availableFixturesForTab.length} matches</small>
                  </button>
                  {data.divisions.map((division) => (
                    <button key={division.id} type="button"
                      className={divisionFilter === division.id ? styles.fixtureDivisionSelected : styles.fixtureDivisionButton}
                      aria-pressed={divisionFilter === division.id}
                      onClick={() => { setDivisionFilter(division.id); setShowAll(false); }}>
                      <span>{division.name}</span>
                      <small>{fixtureCountsByDivision.get(division.id) ?? 0} matches</small>
                    </button>
                  ))}
                </div>
                <label className={styles.fixtureSearchLabel}>
                  Search player, team, division or round
                  <input type="search" value={search} maxLength={80}
                    placeholder="e.g. Division 2A or a player's name"
                    onChange={(event) => { setSearch(event.target.value); setShowAll(false); }} />
                </label>
                <div className={styles.fixtureFilterStatus}>
                  <strong role="status" aria-live="polite">
                    {sortedFixtures.length} {tab === "results" ? "result" : "fixture"}{sortedFixtures.length === 1 ? "" : "s"} found
                  </strong>
                  {(divisionFilter !== "all" || search.trim()) &&
                    <button type="button" onClick={() => { setDivisionFilter("all"); setSearch(""); setShowAll(false); }}>Clear filters</button>}
                </div>
              </div>
            ) : (
              <div className={styles.filterBar}>
                <label>Division
                  <select value={divisionFilter}
                    onChange={(event) => { setDivisionFilter(event.target.value); setShowAll(false); }}>
                    <option value="all">All divisions</option>
                    {data.divisions.map((division) => <option key={division.id}
                      value={division.id}>{division.name}</option>)}
                  </select>
                </label>
                {tab === "teams" &&
                  <label>Search
                    <input type="search" value={search} placeholder="Find players or a team…"
                      onChange={(event) => { setSearch(event.target.value); setShowAll(false); }} />
                  </label>}
              </div>
            )}
            <ClubSponsors sponsors={content.sponsors} context={{clubId:club.id,seasonId,divisionId:divisionFilter === "all" ? undefined : divisionFilter}} position="beside-fixtures" />
            <div className={styles.viewShare}>
              <span>Help players find this section of the league.</span>
              <button type="button" onClick={() => { void copyViewLink(); }}>
                Copy link to this view ↗
              </button>
            </div>
            {exportNotice && <p className={styles.exportNotice} role="status">
              {exportNotice}</p>}
            {(tab === "fixtures" || tab === "results") && <div className={styles.card}>
              <div className={styles.exportActions}>
                <p>{tab === "fixtures"
                  ? "Export the play-by deadlines shown by your filters. These are not booked match times."
                  : "Export only confirmed results shown by your filters. No player contacts are included."}</p>
                <button type="button" disabled={!sortedFixtures.length}
                  onClick={exportFilteredMatches}>
                  {tab === "results" ? "Download results CSV ↓"
                    : "Download deadline calendar ↓"}
                </button>
              </div>
              {!sortedFixtures.length
                ? <div className={styles.fixtureNoMatches}>
                    <strong>No {tab === "results" ? "results" : "fixtures"} match these filters.</strong>
                    <p>Try a different division or player name.</p>
                    <button type="button" onClick={() => { setDivisionFilter("all"); setSearch(""); setShowAll(false); }}>Show all divisions</button>
                  </div>
                : divisionFilter === "all" ? data.divisions.filter((division) =>
                    visibleFixtures.some((fixture) => fixture.division_id === division.id)).map((division) =>
                    <section key={division.id} className={styles.fixtureDivisionGroup}>
                      <h3>{division.name} <span>{fixtureCountsByDivision.get(division.id) ?? 0} matches</span></h3>
                      <ul className={styles.fixtures}>{visibleFixtures.filter((fixture) => fixture.division_id === division.id).map(fixtureRow)}</ul>
                    </section>)
                  : <ul className={styles.fixtures}>{visibleFixtures.map(fixtureRow)}</ul>}
              {!showAll && sortedFixtures.length > visibleFixtures.length &&
                <button type="button" className={styles.more}
                  onClick={() => setShowAll(true)}>
                  Show all {sortedFixtures.length} matches ↓
                </button>}
            </div>}
            {tab === "tables" && filteredDivisions.map((division) =>
              <section className={styles.cardSection} key={division.id}>
                <div className={styles.divisionHeader}><h3>{division.name}</h3></div>
                <div className={styles.card}>{tableFor(division)}</div>
              </section>)}
            {tab === "teams" && <div className={styles.teamGrid}>
              {data.teams.filter((team) => (divisionFilter === "all" ||
                  team.division_id === divisionFilter) &&
                (!search.trim() || [team.name, team.player_one_name, team.player_two_name]
                  .some((value) => value?.toLowerCase().includes(search.toLowerCase()))))
                .map((team) => <article key={team.id} className={styles.teamCard}>
                  <span className={styles.teamIcon}>◉</span>
                  <div className={styles.playerCardBody}><h3>{playerPair(team)}</h3>
                    <span>{data.divisions.find((division) =>
                      division.id === team.division_id)?.name}</span>
                    <div className={styles.playerRatings}>
                      <span><b>{team.player_one_name || "Player 1"}</b><strong>{team.player_one_rating?.toFixed(2) ?? "–"}</strong></span>
                      <span><b>{team.player_two_name || "Player 2"}</b><strong>{team.player_two_rating?.toFixed(2) ?? "–"}</strong></span>
                    </div>
                    {(team.player_one_rating_source === "playtomic" || team.player_two_rating_source === "playtomic") && <small className={styles.ratingSource}>Playtomic ratings</small>}
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
      <ClubSponsors sponsors={content.sponsors} context={{clubId:club.id,seasonId}} position="above-footer" />
      <ClubFooter name={club.name} slug={slug} email={club.contact_email} website={club.website_url} text={club.footer_text} />
    </div>
  </main>;
}
