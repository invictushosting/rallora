"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Home,
  Lock,
  Medal,
  Menu,
  Pencil,
  RefreshCw,
  Trash2,
  Settings,
  Share2,
  ShieldCheck,
  Swords,
  Table2,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import {
  fallbackData,
  type Announcement,
  type Division,
  type Fixture,
  type LeagueData,
  type ResultRow,
  type Sponsor,
  type TeamRow,
} from "@/lib/data";

type PageId =
  | "home"
  | "tables"
  | "fixtures"
  | "results"
  | "teams"
  | "cup"
  | "rules"
  | "captain"
  | "admin";

type NavItem = {
  id: PageId;
  label: string;
  icon: typeof Home;
};

type SeasonRecord = { id: string; name: string; status?: string; starts_on?: string | null; ends_on?: string | null };
type DivisionRecord = { id: string; name: string; sort_order: number };
type TeamRecord = { id: string; name: string; division_id: string; player_one_name?: string | null; player_two_name?: string | null; captain_email?: string | null; is_active?: boolean | null };
type StandingRecord = {
  team_id: string;
  division_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  score_diff: number;
  points: number;
};
type FixtureRecord = {
  id: string;
  week_number: number;
  play_by: string;
  court: string | null;
  status: string;
  division_id: string;
  home_team_id: string;
  away_team_id: string;
  fixture_group_type?: string | null;
  fixture_group_name?: string | null;
  available_from?: string | null;
  fixtures_per_team?: number | null;
};
type ResultRecord = {
  id: string;
  fixture_id: string;
  home_score: string | null;
  away_score: string | null;
  status: string;
  winner_team_id: string | null;
};
type SponsorRecord = { id?: string; name: string; sponsor_type: string | null; placement?: string | null; logo_url?: string | null; website_url?: string | null; sort_order?: number | null; is_active?: boolean | null };
type AnnouncementRecord = { title: string; body: string };

type ClubSettingsRecord = {
  id?: string;
  slug: string;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  contact_email?: string | null;
  website_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  welcome_title?: string | null;
  welcome_text?: string | null;
  footer_text?: string | null;
  is_active?: boolean | null;
};

type ClubSettings = {
  slug: string;
  name: string;
  shortName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  contactEmail: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  welcomeTitle: string;
  welcomeText: string;
  footerText: string;
};

const defaultClubSettings: ClubSettings = {
  slug: "gsm-padel",
  name: "GSM Padel",
  shortName: "GSM",
  logoUrl: "/gsm-logo.png",
  primaryColor: "#2458ff",
  secondaryColor: "#0f172a",
  accentColor: "#2458ff",
  contactEmail: "info@gsmpadelclub.com",
  websiteUrl: "",
  instagramUrl: "",
  facebookUrl: "",
  welcomeTitle: "GSM Padel League Hub",
  welcomeText:
    "Our club. Our league. Our passion. Manage fixtures, tables, results, teams and the League Cup in one clean mobile-first hub.",
  footerText: "Our club. Our league. Our passion.",
};

function mapClubSettings(row?: ClubSettingsRecord | null): ClubSettings {
  if (!row) return defaultClubSettings;
  return {
    slug: row.slug || defaultClubSettings.slug,
    name: row.name || defaultClubSettings.name,
    shortName: row.short_name || row.name || defaultClubSettings.shortName,
    logoUrl: row.logo_url || defaultClubSettings.logoUrl,
    primaryColor: row.primary_color || defaultClubSettings.primaryColor,
    secondaryColor: row.secondary_color || defaultClubSettings.secondaryColor,
    accentColor: row.accent_color || row.primary_color || defaultClubSettings.accentColor,
    contactEmail: row.contact_email || defaultClubSettings.contactEmail,
    websiteUrl: row.website_url || "",
    instagramUrl: row.instagram_url || "",
    facebookUrl: row.facebook_url || "",
    welcomeTitle: row.welcome_title || `${row.name || defaultClubSettings.name} League Hub`,
    welcomeText: row.welcome_text || defaultClubSettings.welcomeText,
    footerText: row.footer_text || defaultClubSettings.footerText,
  };
}

async function loadClubSettings() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("clubs")
      .select(
        "id, slug, name, short_name, logo_url, primary_color, secondary_color, accent_color, contact_email, website_url, instagram_url, facebook_url, welcome_title, welcome_text, footer_text, is_active",
      )
      .eq("slug", "gsm-padel")
      .maybeSingle<ClubSettingsRecord>();

    if (error) return defaultClubSettings;
    return mapClubSettings(data);
  } catch {
    return defaultClubSettings;
  }
}

type AdminUser = { id: string; email?: string };
type AdminDivision = { id: string; name: string; sort_order: number };
type AdminTeam = { id: string; name: string; division_id: string; player_one_name?: string | null; player_two_name?: string | null; captain_email?: string | null; is_active?: boolean | null };
type AdminFixture = {
  id: string;
  week_number: number;
  play_by: string;
  court: string | null;
  status: string;
  division_id: string;
  home_team_id: string;
  away_team_id: string;
  fixture_group_type?: string | null;
  fixture_group_name?: string | null;
  available_from?: string | null;
  fixtures_per_team?: number | null;
};
type GeneratedFixtureRow = {
  season_id: string;
  division_id: string;
  week_number: number;
  home_team_id: string;
  away_team_id: string;
  play_by: string;
  court: string;
  status: string;
  fixture_group_type: string;
  fixture_group_name: string;
  available_from: string | null;
  fixtures_per_team: number | null;
  home_name: string;
  away_name: string;
};

type AdminResult = {
  id: string;
  fixture_id: string;
  home_score: string | null;
  away_score: string | null;
  winner_team_id: string | null;
  notes: string | null;
  status: string;
};
type AdminSponsor = {
  id: string;
  name: string;
  sponsor_type: string | null;
  placement: string | null;
  logo_url: string | null;
  website_url: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

type CupQualifierRuleRecord = {
  id: string;
  season_id: string;
  division_id: string;
  qualifier_count: number;
  sort_order: number | null;
  is_active: boolean | null;
};

type CupManualQualifierRecord = {
  id: string;
  season_id: string;
  team_id: string;
  seed_position: number;
  is_active: boolean | null;
};

const sponsorPlacementOptions = [
  { value: "homepage", label: "Homepage" },
  { value: "league", label: "League Tables Page" },
  { value: "fixtures", label: "Fixtures Page" },
  { value: "cup", label: "League Cup Page" },
  { value: "footer", label: "Footer" },
];

function slugifyPlacement(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatPlacementFallback(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSponsorPlacementOptions(divisions: { name: string }[] = []) {
  const divisionOptions = divisions
    .map((division) => ({
      value: slugifyPlacement(division.name),
      label: division.name,
    }))
    .filter((option) => option.value.length > 0);

  const allOptions = [...sponsorPlacementOptions, { value: "division", label: "All Divisions" }, ...divisionOptions];
  return allOptions.filter(
    (option, index, list) => index === list.findIndex((item) => item.value === option.value),
  );
}

function splitSponsorPlacements(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function sponsorHasPlacement(sponsor: Sponsor, placement: string, includeBlank = false) {
  const placements = splitSponsorPlacements(sponsor.placement);
  if (includeBlank && placements.length === 0) return true;
  return placements.includes(placement.toLowerCase());
}

function filterSponsorsByPlacement(sponsors: Sponsor[], placement: string, includeBlank = false) {
  return sponsors.filter((sponsor) => sponsorHasPlacement(sponsor, placement, includeBlank));
}

function uniqueTextOptions(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => (value ?? "").trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function fixtureGroupLabel(fixture: Fixture) {
  return ((fixture as any).groupName || fixture.week || "Fixtures") as string;
}

function fixtureIsCompleted(fixture: Fixture) {
  return ["Confirmed", "Forfeit", "Double Forfeit"].includes(fixture.status);
}

function textIncludes(value: string, search: string) {
  return value.toLowerCase().includes(search.trim().toLowerCase());
}

function teamShareSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getPublicShareUrl(hash: string) {
  if (typeof window === "undefined") return hash;
  return `${window.location.origin}${window.location.pathname}${hash}`;
}

function formatRecord(team: Pick<TeamRow, "won" | "drawn" | "lost">) {
  return `${team.won}W · ${team.drawn}D · ${team.lost}L`;
}

function formatSponsorPlacements(value?: string | null) {
  const placements = splitSponsorPlacements(value);
  if (placements.length === 0) return "Homepage";
  const options = getSponsorPlacementOptions();
  return placements
    .map((placement) => options.find((option) => option.value === placement)?.label ?? formatPlacementFallback(placement))
    .join(", ");
}
type CaptainUserRecord = {
  id: string;
  email: string;
  team_id: string;
  display_name: string | null;
  created_at?: string;
};
type CaptainSubmissionRecord = {
  id: string;
  fixture_id: string;
  submitting_team_id: string;
  submitted_by_email: string | null;
  home_score: string | null;
  away_score: string | null;
  winner_team_id: string | null;
  notes: string | null;
  status: string;
  opponent_confirmed_by_email?: string | null;
  created_at: string;
};
type ResultType =
  | "home_win"
  | "away_win"
  | "home_forfeit"
  | "away_forfeit"
  | "double_forfeit";

const nav: NavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "tables", label: "Tables", icon: Table2 },
  { id: "fixtures", label: "Fixtures", icon: CalendarDays },
  { id: "results", label: "Results", icon: ClipboardList },
  { id: "teams", label: "Teams", icon: Users },
  { id: "cup", label: "Cup", icon: Trophy },
  { id: "rules", label: "Rules", icon: ShieldCheck },
  { id: "captain", label: "Captain", icon: UserRound },
  { id: "admin", label: "Admin", icon: Lock },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatMatchDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatDeadline(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function prettyStatus(value: string): Fixture["status"] {
  if (value === "submitted") return "Submitted";
  if (value === "confirmed") return "Confirmed";
  if (value === "disputed") return "Disputed";
  if (value === "forfeit") return "Forfeit";
  if (value === "double_forfeit") return "Double Forfeit";
  return "Open";
}

async function loadLeagueData(): Promise<LeagueData> {
  const supabase = createClient();

  const { data: seasonRows, error: seasonError } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<SeasonRecord[]>();

  if (seasonError) throw seasonError;
  const season = seasonRows?.[0];
  if (!season) throw new Error("No active season found in Supabase.");

  const { data: divisionRows, error: divisionError } = await supabase
    .from("divisions")
    .select("id, name, sort_order")
    .eq("season_id", season.id)
    .order("sort_order", { ascending: true })
    .returns<DivisionRecord[]>();

  if (divisionError) throw divisionError;

  const divisionsFromDb = divisionRows ?? [];
  const divisionIds = divisionsFromDb.map((division) => division.id);

  if (divisionIds.length === 0) {
    return { ...fallbackData, seasonName: season.name };
  }

  const [
    teamsResponse,
    standingsResponse,
    fixturesResponse,
    sponsorsResponse,
    announcementsResponse,
    resultsResponse,
  ] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, division_id, player_one_name, player_two_name, captain_email, is_active")
      .in("division_id", divisionIds)
      .returns<TeamRecord[]>(),
    supabase
      .from("standings")
      .select(
        "team_id, division_id, played, won, drawn, lost, score_diff, points",
      )
      .eq("season_id", season.id)
      .returns<StandingRecord[]>(),
    supabase
      .from("fixtures")
      .select(
        "id, week_number, play_by, court, status, division_id, home_team_id, away_team_id, fixture_group_type, fixture_group_name, available_from, fixtures_per_team",
      )
      .eq("season_id", season.id)
      .order("week_number", { ascending: false })
      .order("play_by", { ascending: true })
      .limit(24)
      .returns<FixtureRecord[]>(),
    supabase
      .from("sponsors")
      .select("id, name, sponsor_type, placement, logo_url, website_url, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .returns<SponsorRecord[]>(),
    supabase
      .from("announcements")
      .select("title, body")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<AnnouncementRecord[]>(),
    supabase
      .from("results")
      .select("id, fixture_id, home_score, away_score, status, winner_team_id")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<ResultRecord[]>(),
  ]);

  if (teamsResponse.error) throw teamsResponse.error;
  if (standingsResponse.error) throw standingsResponse.error;
  if (fixturesResponse.error) throw fixturesResponse.error;
  if (sponsorsResponse.error) throw sponsorsResponse.error;
  if (announcementsResponse.error) throw announcementsResponse.error;
  if (resultsResponse.error) throw resultsResponse.error;

  const teams = teamsResponse.data ?? [];
  const standings = standingsResponse.data ?? [];
  const fixtureRows = fixturesResponse.data ?? [];
  const resultRows = resultsResponse.data ?? [];

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const divisionById = new Map(
    divisionsFromDb.map((division) => [division.id, division]),
  );
  const standingByTeamId = new Map(
    standings.map((standing) => [standing.team_id, standing]),
  );

  const divisions: Division[] = divisionsFromDb.map((division) => {
    const divisionTeams: TeamRow[] = teams
      .filter((team) => team.division_id === division.id)
      .map((team) => {
        const standing = standingByTeamId.get(team.id);
        return {
          id: team.id,
          name: team.name,
          playerOneName: team.player_one_name ?? null,
          playerTwoName: team.player_two_name ?? null,
          captainEmail: team.captain_email ?? null,
          isActive: team.is_active ?? true,
          played: standing?.played ?? 0,
          won: standing?.won ?? 0,
          drawn: standing?.drawn ?? 0,
          lost: standing?.lost ?? 0,
          diff: standing?.score_diff ?? 0,
          points: standing?.points ?? 0,
        };
      })
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.diff - a.diff ||
          a.name.localeCompare(b.name),
      );

    return {
      id: division.id,
      name: division.name,
      sortOrder: division.sort_order,
      teams: divisionTeams,
    };
  });

  const fixtures: Fixture[] = fixtureRows.map((fixture) => ({
    id: fixture.id,
    division:
      divisionById.get(fixture.division_id)?.name.replace("Division", "Div") ??
      "Division",
    week: fixture.fixture_group_name || `Week ${fixture.week_number}`,
    date: formatMatchDate(fixture.available_from || fixture.play_by),
    deadline: formatDeadline(fixture.play_by),
    home: teamById.get(fixture.home_team_id)?.name ?? "Home team",
    away: teamById.get(fixture.away_team_id)?.name ?? "Away team",
    court: fixture.court ?? "Arrange",
    status: prettyStatus(fixture.status),
    groupType: fixture.fixture_group_type ?? "weekly",
    groupName: fixture.fixture_group_name ?? null,
    availableFrom: fixture.available_from ?? null,
    fixturesPerTeam: fixture.fixtures_per_team ?? null,
  }));

  const fixtureById = new Map(
    fixtureRows.map((fixture) => [fixture.id, fixture]),
  );
  const results: ResultRow[] = resultRows.map((result) => {
    const fixture = fixtureById.get(result.fixture_id);
    const homeTeam = fixture
      ? teamById.get(fixture.home_team_id)?.name
      : "Home team";
    const awayTeam = fixture
      ? teamById.get(fixture.away_team_id)?.name
      : "Away team";
    const division = fixture
      ? (divisionById
          .get(fixture.division_id)
          ?.name.replace("Division", "Div") ?? "Division")
      : "Result";
    const score =
      [result.home_score, result.away_score].filter(Boolean).join(" - ") ||
      "Score submitted";
    return {
      division,
      teams: `${homeTeam} vs ${awayTeam}`,
      score,
      status: result.status.replaceAll("_", " "),
    };
  });

  const sponsors: Sponsor[] = (sponsorsResponse.data ?? []).map((sponsor) => ({
    name: sponsor.name,
    sponsorType: sponsor.sponsor_type,
    placement: sponsor.placement ?? null,
    logoUrl: sponsor.logo_url ?? null,
    websiteUrl: sponsor.website_url ?? null,
  }));

  const announcements: Announcement[] = announcementsResponse.data ?? [];

  return {
    seasonName: season.name,
    divisions,
    fixtures,
    results,
    sponsors: sponsors.length ? sponsors : fallbackData.sponsors,
    announcements: announcements.length
      ? announcements
      : fallbackData.announcements,
  };
}

export default function GsmPadelLeagueHub() {
  const [active, setActive] = useState<PageId>("home");
  const [leagueData, setLeagueData] = useState<LeagueData>(fallbackData);
  const [clubSettings, setClubSettings] = useState<ClubSettings>(defaultClubSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    function syncPageFromHash() {
      if (typeof window === "undefined") return;
      const hash = window.location.hash.toLowerCase();
      if (hash.startsWith("#team=")) setActive("teams");
      if (hash === "#fixtures") setActive("fixtures");
      if (hash === "#tables") setActive("tables");
      if (hash === "#teams") setActive("teams");
      if (hash === "#captain") setActive("captain");
      if (hash === "#admin") setActive("admin");
      if (hash === "#cup") setActive("cup");
    }

    syncPageFromHash();
    window.addEventListener("hashchange", syncPageFromHash);
    return () => window.removeEventListener("hashchange", syncPageFromHash);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setIsLoading(true);
        const [liveData, liveClubSettings] = await Promise.all([
          loadLeagueData(),
          loadClubSettings(),
        ]);
        if (!cancelled) {
          setLeagueData(liveData);
          setClubSettings(liveClubSettings);
          setLoadError(null);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not load live Supabase data.";
        if (!cancelled) setLoadError(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const page = useMemo(() => {
    if (active === "tables")
      return <TablesPage divisions={leagueData.divisions} sponsors={leagueData.sponsors} />;
    if (active === "fixtures")
      return <FixturesPage fixtures={leagueData.fixtures} sponsors={leagueData.sponsors} />;
    if (active === "results")
      return <ResultsPage results={leagueData.results} />;
    if (active === "teams")
      return <TeamsPage divisions={leagueData.divisions} />;
    if (active === "cup") return <CupPage divisions={leagueData.divisions} sponsors={leagueData.sponsors} />;
    if (active === "rules") return <RulesPage club={clubSettings} />;
    if (active === "captain")
      return <CaptainPage onDataChanged={() => setRefreshToken((value) => value + 1)} />;
    if (active === "admin")
      return (
        <AdminPage
          fixtures={leagueData.fixtures}
          onDataChanged={() => setRefreshToken((value) => value + 1)}
          club={clubSettings}
        />
      );
    return (
      <HomePage
        data={leagueData}
        club={clubSettings}
        isLoading={isLoading}
        loadError={loadError}
        setActive={setActive}
      />
    );
  }, [active, leagueData, isLoading, loadError]);

  return (
    <div
      className="app-shell"
      style={{
        "--brand-primary": clubSettings.primaryColor,
        "--brand-secondary": clubSettings.secondaryColor,
        "--brand-accent": clubSettings.accentColor,
      } as CSSProperties}
    >
      <Header active={active} setActive={setActive} club={clubSettings} />
      {page}
      <Footer setActive={setActive} club={clubSettings} />
      <MobileNav active={active} setActive={setActive} />
    </div>
  );
}

function Header({
  active,
  setActive,
  club,
}: {
  active: PageId;
  setActive: (page: PageId) => void;
  club: ClubSettings;
}) {
  return (
    <header className="site-header">
      <button
        className="logo-button"
        onClick={() => setActive("home")}
        aria-label="Go home"
      >
        <img src={club.logoUrl} alt={club.name} className="logo" />
        <div className="logo-copy">
          <strong>League Hub</strong>
          <span>{club.shortName} club manager</span>
        </div>
      </button>

      <nav className="desktop-nav">
        {nav.filter((item) => item.id !== "admin").map((item) => (
          <button
            key={item.id}
            className={cx("nav-link", active === item.id && "active")}
            onClick={() => setActive(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <button className="admin-button" onClick={() => setActive("admin")}>
        <Lock size={16} /> Admin Login
      </button>
      <button className="menu-button" aria-label="Admin login" onClick={() => setActive("admin")}>
        <Lock />
      </button>
    </header>
  );
}

function HomePage({
  data,
  club,
  isLoading,
  loadError,
  setActive,
}: {
  data: LeagueData;
  club: ClubSettings;
  isLoading: boolean;
  loadError: string | null;
  setActive: (page: PageId) => void;
}) {
  const firstAnnouncement = data.announcements[0];
  const teamCount = data.divisions.reduce(
    (total, division) => total + division.teams.length,
    0,
  );
  const firstDivision = data.divisions[0] ?? fallbackData.divisions[0];
  const currentWeek = data.fixtures[0]?.week ?? "Weekly";

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <div className="announcement-pill">
            <Bell size={16} />{" "}
            {isLoading
              ? "Loading live league data..."
              : (firstAnnouncement?.title ?? "League hub live")}
          </div>
          <h1>
            {club.name} <span>League Hub</span>
          </h1>
          <p>{club.welcomeText}</p>
          {loadError && (
            <p className="live-warning">
              Live data did not load, showing demo data: {loadError}
            </p>
          )}
          <div className="hero-actions">
            <button
              className="primary-button"
              onClick={() => setActive("fixtures")}
            >
              View fixtures <ChevronRight size={18} />
            </button>
            <button
              className="secondary-button"
              onClick={() => setActive("tables")}
            >
              See league tables
            </button>
          </div>
        </div>
        <div className="season-card">
          <Trophy className="season-icon" />
          <span>Current season</span>
          <h2>{data.seasonName}</h2>
          <div className="mini-grid">
            <MiniStat icon={Users} value={`${teamCount}`} label="Teams" />
            <MiniStat
              icon={Trophy}
              value={`${data.divisions.length}`}
              label="Divisions"
            />
            <MiniStat
              icon={CalendarDays}
              value={currentWeek}
              label="Fixtures"
            />
            <MiniStat icon={Swords} value="Fast4" label="Cup" />
          </div>
        </div>
      </section>

      <main className="page-wrap home-grid-wrap">
        <div className="division-grid">
          {data.divisions.map((division, index) => (
            <button
              key={division.id}
              className="division-card"
              onClick={() => setActive("tables")}
            >
              <span>{index + 1}</span>
              <div>
                <strong>{division.name}</strong>
                <small>{division.teams.length} teams · 28 fixtures</small>
              </div>
              <Users />
            </button>
          ))}
        </div>

        <div className="dashboard-grid">
          <Card>
            <SectionTitle
              icon={Trophy}
              title={`League Table — ${firstDivision.name}`}
              action="View all tables"
              onClick={() => setActive("tables")}
            />
            <LeagueTable division={firstDivision} compact />
          </Card>
          <Card>
            <SectionTitle
              icon={CalendarDays}
              title="Upcoming Fixtures"
              action="View all"
              onClick={() => setActive("fixtures")}
            />
            <FixtureList fixtures={data.fixtures} compact />
          </Card>
          <Card dark>
            <Trophy size={48} />
            <h2>League Cup</h2>
            <p>
              Top 3 from Div 1, Top 3 from Div 2 and Top 2 from Div 3 qualify.
            </p>
            <button
              className="primary-button full"
              onClick={() => setActive("cup")}
            >
              View Cup Info
            </button>
          </Card>
        </div>

        <Sponsors sponsors={filterSponsorsByPlacement(data.sponsors, "homepage", true)} />
      </main>
    </>
  );
}

function MiniStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Users;
  value: string;
  label: string;
}) {
  return (
    <div className="mini-stat">
      <Icon size={22} />
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Card({
  children,
  dark = false,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <section className={cx("card", dark && "card-dark")}>{children}</section>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  action,
  onClick,
}: {
  icon: typeof Trophy;
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="section-title">
      <div>
        <Icon size={20} />
        <h2>{title}</h2>
      </div>
      {action && <button onClick={onClick}>{action} →</button>}
    </div>
  );
}

function LeagueTable({
  division,
  compact = false,
}: {
  division: Division;
  compact?: boolean;
}) {
  const rows = compact ? division.teams.slice(0, 5) : division.teams;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>P</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th>Diff</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((team, index) => (
            <tr key={team.name}>
              <td>{index + 1}</td>
              <td>{team.name}</td>
              <td>{team.played}</td>
              <td>{team.won}</td>
              <td>{team.drawn}</td>
              <td>{team.lost}</td>
              <td>{team.diff > 0 ? `+${team.diff}` : team.diff}</td>
              <td>
                <strong>{team.points}</strong>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8}>No teams added yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FixtureList({
  fixtures,
  compact = false,
}: {
  fixtures: Fixture[];
  compact?: boolean;
}) {
  const list = compact ? fixtures.slice(0, 3) : fixtures;
  if (list.length === 0)
    return <p className="empty-state">No fixtures added yet.</p>;

  return (
    <div className="fixture-list">
      {list.map((fixture) => (
        <article
          className="fixture-card"
          key={fixture.id ?? `${fixture.home}-${fixture.away}`}
        >
          <div className="date-box">
            <span>{fixture.date.split(" ")[0]}</span>
            <strong>{fixture.date.split(" ")[1]}</strong>
            <span>{fixture.date.split(" ")[2]}</span>
          </div>
          <div className="fixture-main">
            <small>
              {fixture.division} · {fixture.week}
            </small>
            <strong>
              {fixture.home} <em>vs</em> {fixture.away}
            </strong>
          </div>
          <div className="fixture-deadline">
            <span>{(fixture as any).groupType === "monthly" || (fixture as any).groupType === "custom" ? "Deadline" : "Arrange by"}</span>
            <strong>{fixture.deadline}</strong>
            {((fixture as any).groupType === "monthly" || (fixture as any).groupType === "custom") && (
              <em>Any order</em>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function TablesPage({ divisions, sponsors }: { divisions: Division[]; sponsors: Sponsor[] }) {
  const [selected, setSelected] = useState(divisions[0]?.id ?? "");
  const division =
    divisions.find((item) => item.id === selected) ?? divisions[0];
  const selectedDivisionPlacement = division ? slugifyPlacement(division.name) : "";
  const pageSponsors = [
    ...filterSponsorsByPlacement(sponsors, "league"),
    ...filterSponsorsByPlacement(sponsors, selectedDivisionPlacement),
    ...filterSponsorsByPlacement(sponsors, "division"),
  ].filter((sponsor, index, list) =>
    index === list.findIndex((item) => item.name === sponsor.name && item.sponsorType === sponsor.sponsorType)
  );

  useEffect(() => {
    if (!divisions.some((divisionItem) => divisionItem.id === selected)) {
      setSelected(divisions[0]?.id ?? "");
    }
  }, [divisions, selected]);

  return (
    <PageShell
      icon={Table2}
      title="League Tables"
      subtitle="Live standings by division."
    >
      <div className="tabs">
        {divisions.map((item) => (
          <button
            key={item.id}
            className={cx(selected === item.id && "active")}
            onClick={() => setSelected(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>
      {division ? (
        <Card>
          <SectionTitle icon={Trophy} title={division.name} />
          <LeagueTable division={division} />
        </Card>
      ) : (
        <Card>No divisions added yet.</Card>
      )}
      {pageSponsors.length > 0 && <Sponsors title="League Sponsors" sponsors={pageSponsors} />}
    </PageShell>
  );
}

function FixturesPage({ fixtures, sponsors }: { fixtures: Fixture[]; sponsors: Sponsor[] }) {
  const [selectedDivision, setSelectedDivision] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("upcoming");
  const [searchTerm, setSearchTerm] = useState("");

  const divisionOptions = uniqueTextOptions(fixtures.map((fixture) => fixture.division));
  const groupOptions = uniqueTextOptions(fixtures.map((fixture) => fixtureGroupLabel(fixture)));

  const filteredFixtures = fixtures.filter((fixture) => {
    const group = fixtureGroupLabel(fixture);
    const searchBlob = `${fixture.home} ${fixture.away} ${fixture.division} ${fixture.week} ${group}`;

    if (selectedDivision !== "all" && fixture.division !== selectedDivision) return false;
    if (selectedGroup !== "all" && group !== selectedGroup) return false;
    if (selectedStatus === "upcoming" && fixtureIsCompleted(fixture)) return false;
    if (selectedStatus === "completed" && !fixtureIsCompleted(fixture)) return false;
    if (searchTerm.trim() && !textIncludes(searchBlob, searchTerm)) return false;
    return true;
  });

  return (
    <PageShell
      icon={CalendarDays}
      title="Fixtures"
      subtitle="Filter by league, fixture pack, status or team."
    >
      <Card>
        <SectionTitle
          icon={CalendarDays}
          title="Fixtures"
          action={`${filteredFixtures.length} shown`}
        />
        <div className="public-filter-panel">
          <label>
            <span>League</span>
            <select value={selectedDivision} onChange={(event) => setSelectedDivision(event.target.value)}>
              <option value="all">All leagues</option>
              {divisionOptions.map((division) => (
                <option key={division} value={division}>{division}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Week / pack</span>
            <select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)}>
              <option value="all">All weeks / packs</option>
              {groupOptions.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
              <option value="upcoming">Upcoming only</option>
              <option value="completed">Completed only</option>
              <option value="all">All fixtures</option>
            </select>
          </label>
          <label className="public-filter-search">
            <span>Search team</span>
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Type a team name..." />
          </label>
        </div>
        <FixtureList fixtures={filteredFixtures} />
      </Card>
      {filterSponsorsByPlacement(sponsors, "fixtures").length > 0 && (
        <Sponsors title="Fixtures Sponsors" sponsors={filterSponsorsByPlacement(sponsors, "fixtures")} />
      )}
    </PageShell>
  );
}

function ResultsPage({ results }: { results: ResultRow[] }) {
  const [selectedDivision, setSelectedDivision] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const divisionOptions = uniqueTextOptions(results.map((result) => result.division));

  const filteredResults = results.filter((result) => {
    if (selectedDivision !== "all" && result.division !== selectedDivision) return false;
    if (searchTerm.trim() && !textIncludes(`${result.teams} ${result.score} ${result.status}`, searchTerm)) return false;
    return true;
  });

  return (
    <PageShell
      icon={ClipboardList}
      title="Results"
      subtitle="Confirmed results and admin decisions."
    >
      <Card>
        <SectionTitle icon={ClipboardList} title="Result filters" action={`${filteredResults.length} shown`} />
        <div className="public-filter-panel compact">
          <label>
            <span>League</span>
            <select value={selectedDivision} onChange={(event) => setSelectedDivision(event.target.value)}>
              <option value="all">All leagues</option>
              {divisionOptions.map((division) => (
                <option key={division} value={division}>{division}</option>
              ))}
            </select>
          </label>
          <label className="public-filter-search">
            <span>Search</span>
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Team, score or status..." />
          </label>
        </div>
      </Card>
      {filteredResults.length === 0 ? (
        <Card>
          <p className="empty-state">
            No results match those filters yet.
          </p>
        </Card>
      ) : (
        <div className="result-grid polished-grid">
          {filteredResults.map((result) => (
            <Card key={`${result.teams}-${result.score}`}>
              <small className="blue-label">{result.division}</small>
              <h3>{result.teams}</h3>
              <p>{result.score}</p>
              <span className="status-pill">{result.status}</span>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function TeamsPage({ divisions }: { divisions: Division[] }) {
  const [selectedDivision, setSelectedDivision] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState("points");
  const [selectedTeam, setSelectedTeam] = useState<(TeamRow & { division: string }) | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const teams = divisions.flatMap((division) =>
    division.teams.map((team) => ({ ...team, division: division.name })),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash.toLowerCase().startsWith("#team=")) return;
    const teamSlug = decodeURIComponent(hash.replace("#team=", ""));
    const match = teams.find((team) => teamShareSlug(team.name) === teamSlug);
    if (match) setSelectedTeam(match);
  }, [divisions]);

  const divisionOptions = divisions.map((division) => division.name);
  const filteredTeams = teams
    .filter((team) => {
      if (selectedDivision !== "all" && team.division !== selectedDivision) return false;
      const searchBlob = `${team.name} ${team.division} ${team.playerOneName ?? ""} ${team.playerTwoName ?? ""}`;
      if (searchTerm.trim() && !textIncludes(searchBlob, searchTerm)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "league") return a.division.localeCompare(b.division) || b.points - a.points;
      return b.points - a.points || b.diff - a.diff || a.name.localeCompare(b.name);
    });

  async function openTeamProfile(team: TeamRow & { division: string }) {
    setSelectedTeam(team);
    setShareMessage(null);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#team=${teamShareSlug(team.name)}`);
    }
  }

  function closeTeamProfile() {
    setSelectedTeam(null);
    setShareMessage(null);
    if (typeof window !== "undefined" && window.location.hash.toLowerCase().startsWith("#team=")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  async function shareTeam(team: TeamRow & { division: string }) {
    const url = getPublicShareUrl(`#team=${teamShareSlug(team.name)}`);
    const title = `${team.name} - ${team.division}`;
    const text = `${team.name} are in ${team.division}. ${team.points} points, ${formatRecord(team)}.`;

    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({ title, text, url });
        setShareMessage("Share sheet opened.");
        return;
      }

      const browserNavigator =
        typeof window !== "undefined"
          ? (window.navigator as Navigator & {
              clipboard?: {
                writeText?: (text: string) => Promise<void>;
              };
            })
          : null;

      if (browserNavigator?.clipboard?.writeText) {
        await browserNavigator.clipboard.writeText(url);
        setShareMessage("Team link copied.");
        return;
      }

      setShareMessage(url);
    } catch {
      setShareMessage("Could not share automatically. Copy the browser link instead.");
    }
  }

  return (
    <PageShell
      icon={Users}
      title="Teams"
      subtitle="Search teams, players and leagues across the current season."
    >
      <Card>
        <SectionTitle icon={Users} title="Team filters" action={`${filteredTeams.length} teams`} />
        <div className="public-filter-panel compact">
          <label>
            <span>League</span>
            <select value={selectedDivision} onChange={(event) => setSelectedDivision(event.target.value)}>
              <option value="all">All leagues</option>
              {divisionOptions.map((division) => (
                <option key={division} value={division}>{division}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Sort by</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
              <option value="points">Points</option>
              <option value="league">League</option>
              <option value="name">Team name</option>
            </select>
          </label>
          <label className="public-filter-search">
            <span>Search</span>
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Team or player name..." />
          </label>
        </div>
      </Card>
      <div className="team-grid polished-grid">
        {filteredTeams.map((team) => (
          <Card key={team.id ?? team.name}>
            <div className="team-card polished-team-card team-profile-card">
              <UserRound />
              <div className="team-profile-card-main">
                <h3>{team.name}</h3>
                <p>
                  {team.division} · {team.points} pts · {team.played} played
                </p>
                {(team.playerOneName || team.playerTwoName) && (
                  <small className="team-players">
                    {[team.playerOneName, team.playerTwoName].filter(Boolean).join(" / ")}
                  </small>
                )}
                <div className="team-card-actions">
                  <button type="button" onClick={() => openTeamProfile(team)}>View profile</button>
                  <button type="button" onClick={() => shareTeam(team)}><Share2 /> Share</button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {filteredTeams.length === 0 && <Card><p className="empty-state">No teams match those filters.</p></Card>}

      {selectedTeam && (
        <div className="team-profile-modal-backdrop" role="presentation" onClick={closeTeamProfile}>
          <div className="team-profile-modal" role="dialog" aria-modal="true" aria-label={`${selectedTeam.name} team profile`} onClick={(event) => event.stopPropagation()}>
            <div className="team-profile-modal-header">
              <div>
                <small className="blue-label">{selectedTeam.division}</small>
                <h2>{selectedTeam.name}</h2>
                <p>{selectedTeam.points} points · {formatRecord(selectedTeam)}</p>
              </div>
              <button type="button" className="modal-close-button" onClick={closeTeamProfile}>Close</button>
            </div>

            <div className="team-profile-stat-grid">
              <div><strong>{selectedTeam.played}</strong><span>Played</span></div>
              <div><strong>{selectedTeam.won}</strong><span>Won</span></div>
              <div><strong>{selectedTeam.drawn}</strong><span>Drawn</span></div>
              <div><strong>{selectedTeam.lost}</strong><span>Lost</span></div>
              <div><strong>{selectedTeam.diff > 0 ? `+${selectedTeam.diff}` : selectedTeam.diff}</strong><span>Diff</span></div>
              <div><strong>{selectedTeam.points}</strong><span>Points</span></div>
            </div>

            <div className="team-profile-detail-grid">
              <div>
                <span>Player 1</span>
                <strong>{selectedTeam.playerOneName || "TBC"}</strong>
              </div>
              <div>
                <span>Player 2</span>
                <strong>{selectedTeam.playerTwoName || "TBC"}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{selectedTeam.isActive === false ? "Inactive" : "Active"}</strong>
              </div>
              <div>
                <span>Shareable profile</span>
                <strong>Ready for WhatsApp groups</strong>
              </div>
            </div>

            <div className="team-profile-actions">
              <button type="button" onClick={() => shareTeam(selectedTeam)}><Share2 /> Share team profile</button>
              {shareMessage && <span>{shareMessage}</span>}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function CupPage({
  divisions,
  sponsors,
}: {
  divisions: Division[];
  sponsors: Sponsor[];
}) {
  const [cupRules, setCupRules] = useState<CupQualifierRuleRecord[]>([]);
  const [manualQualifiers, setManualQualifiers] = useState<CupManualQualifierRecord[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadCupSettings() {
      try {
        const supabase = createClient();
        const { data: seasonRows } = await supabase
          .from("seasons")
          .select("id")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);
        const activeSeasonId = seasonRows?.[0]?.id;
        if (!activeSeasonId) return;

        const [rulesResponse, manualResponse] = await Promise.all([
          supabase
            .from("cup_qualifier_rules")
            .select("id, season_id, division_id, qualifier_count, sort_order, is_active")
            .eq("season_id", activeSeasonId)
            .order("sort_order", { ascending: true }),
          supabase
            .from("cup_manual_qualifiers")
            .select("id, season_id, team_id, seed_position, is_active")
            .eq("season_id", activeSeasonId)
            .eq("is_active", true)
            .order("seed_position", { ascending: true }),
        ]);

        if (!mounted) return;
        if (!rulesResponse.error) setCupRules((rulesResponse.data ?? []) as CupQualifierRuleRecord[]);
        if (!manualResponse.error) setManualQualifiers((manualResponse.data ?? []) as CupManualQualifierRecord[]);
      } catch {
        // Keep public cup page usable even before cup admin tables are installed.
      }
    }

    loadCupSettings();

    return () => {
      mounted = false;
    };
  }, []);

  const teamsWithDivision = divisions.flatMap((division) =>
    division.teams.map((team) => ({ team, division })),
  );

  const manualQualifierRows = manualQualifiers
    .map((qualifier) => {
      const match = teamsWithDivision.find((item) => item.team.id === qualifier.team_id);
      if (!match) return null;
      return {
        team: match.team,
        divisionName: match.division.name,
        seed: qualifier.seed_position,
      };
    })
    .filter(Boolean) as Array<{ team: TeamRow; divisionName: string; seed: number }>;

  const defaultCupRules = divisions.slice(0, 3).map((division, index) => ({
    divisionId: division.id,
    divisionName: division.name,
    qualifierCount: index === 2 ? 2 : 3,
    sortOrder: index + 1,
  }));

  const activeRuleRows = cupRules
    .filter((rule) => rule.is_active !== false && rule.qualifier_count > 0)
    .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))
    .map((rule) => {
      const division = divisions.find((item) => item.id === rule.division_id);
      if (!division) return null;
      return {
        divisionId: division.id,
        divisionName: division.name,
        qualifierCount: rule.qualifier_count,
        sortOrder: rule.sort_order ?? 99,
      };
    })
    .filter(Boolean) as Array<{ divisionId?: string; divisionName: string; qualifierCount: number; sortOrder: number }>;

  const autoRuleRows = activeRuleRows.length ? activeRuleRows : defaultCupRules;
  const autoQualifiers = autoRuleRows.flatMap((rule) => {
    const division = divisions.find((item) => item.id === rule.divisionId || item.name === rule.divisionName);
    return (division?.teams ?? []).slice(0, rule.qualifierCount).map((team) => ({
      team,
      divisionName: division?.name ?? rule.divisionName,
      seed: 0,
    }));
  });

  const qualifiers = (manualQualifierRows.length ? manualQualifierRows : autoQualifiers).slice(0, 16);

  const bracketPairs = [
    [qualifiers[0], qualifiers[7]],
    [qualifiers[3], qualifiers[4]],
    [qualifiers[1], qualifiers[6]],
    [qualifiers[2], qualifiers[5]],
  ];

  const cupSponsors = sponsors.filter((sponsor) =>
    sponsorHasPlacement(sponsor, "cup") ||
    (sponsor.sponsorType ?? "").toLowerCase().includes("cup")
  );
  const featuredSponsors = cupSponsors.length ? cupSponsors : sponsors.slice(0, 3);
  const qualificationSummary = autoRuleRows.map((rule) => `Top ${rule.qualifierCount} ${rule.divisionName}`);

  return (
    <PageShell
      icon={Trophy}
      title="League Cup"
      subtitle="Automatic qualifiers, sponsor slots and knockout bracket."
    >
      <div className="cup-grid">
        <Card dark>
          <Trophy size={64} />
          <h2>GSM League Cup</h2>
          <p>{qualifiers.length || 8} teams. 1 day. 1 champion.</p>
          <div className="cup-meta-grid">
            {qualificationSummary.length ? qualificationSummary.map((item) => (
              <span key={item}>{item}</span>
            )) : <span>Set qualification rules in admin</span>}
          </div>
          <p className="helper-text">{manualQualifierRows.length ? "Manual qualifiers selected by admin." : "Auto qualifiers based on live league tables."}</p>
        </Card>
        <Card>
          <SectionTitle icon={Medal} title="Live Qualifiers" />
          <div className="qualifier-grid">
            {qualifiers.map((qualifier, index) => (
              <div key={`${qualifier.team.id ?? qualifier.team.name}-${index}`} className="qualifier">
                <span>{index + 1}</span>
                <div>
                  <strong>{qualifier.team.name}</strong>
                  <small>{qualifier.divisionName}</small>
                </div>
              </div>
            ))}
            {qualifiers.length === 0 && <p className="empty-state">No qualifiers yet.</p>}
          </div>
        </Card>
      </div>

      <div className="cup-details-grid">
        <Card>
          <SectionTitle icon={Swords} title="Knockout Bracket" />
          <div className="bracket-grid">
            <div>
              <h3>Quarter Finals</h3>
              {bracketPairs.map(([home, away], index) => (
                <div className="bracket-match" key={`qf-${index}`}>
                  <span>{home?.team.name ?? "Qualifier"}</span>
                  <em>vs</em>
                  <span>{away?.team.name ?? "Qualifier"}</span>
                </div>
              ))}
            </div>
            <div>
              <h3>Semi Finals</h3>
              <div className="bracket-match muted"><span>QF 1 Winner</span><em>vs</em><span>QF 2 Winner</span></div>
              <div className="bracket-match muted"><span>QF 3 Winner</span><em>vs</em><span>QF 4 Winner</span></div>
            </div>
            <div>
              <h3>Final</h3>
              <div className="bracket-match final"><span>SF 1 Winner</span><em>vs</em><span>SF 2 Winner</span></div>
              <p className="helper-text">Fast4 format. One-day event. Winner added to previous champions.</p>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={Trophy} title="Cup Sponsors" />
          <div className="sponsor-slot-grid compact">
            {featuredSponsors.map((sponsor) => (
              <a
                key={`${sponsor.name}-${sponsor.sponsorType ?? "sponsor"}`}
                className="sponsor-slot"
                href={sponsor.websiteUrl || undefined}
                target={sponsor.websiteUrl ? "_blank" : undefined}
                rel={sponsor.websiteUrl ? "noreferrer" : undefined}
              >
                <SponsorLogo sponsor={sponsor} />
                <small>{sponsor.sponsorType ?? "Sponsor"}</small>
              </a>
            ))}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

function RulesPage({ club }: { club: ClubSettings }) {
  const rules = [
    [
      CheckCircle2,
      "Win = 3 points",
      "Confirmed wins automatically update the table.",
    ],
    [
      CheckCircle2,
      "Loss = 0 points",
      "Losses are recorded with score difference.",
    ],
    [
      ShieldCheck,
      "Score confirmation",
      "One captain submits. Opponent confirms. Admin can override.",
    ],
    [
      CalendarDays,
      "Weekly fixture release",
      "Fixtures are released every Sunday morning.",
    ],
  ] as const;
  return (
    <PageShell
      icon={ShieldCheck}
      title="Rules"
      subtitle={`${club.name} rules for players and captains.`}
    >
      <div className="rules-grid">
        {rules.map(([Icon, title, copy]) => (
          <Card key={title}>
            <Icon className="blue-icon" />
            <h3>{title}</h3>
            <p>{copy}</p>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}

function AdminPage({
  fixtures,
  onDataChanged,
  club,
}: {
  fixtures: Fixture[];
  onDataChanged: () => void;
  club: ClubSettings;
}) {
  const supabase = createClient();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeAdminTab, setActiveAdminTab] = useState("overview");

  const [clubName, setClubName] = useState(club.name);
  const [clubShortName, setClubShortName] = useState(club.shortName);
  const [clubLogoUrl, setClubLogoUrl] = useState(club.logoUrl);
  const [clubPrimaryColor, setClubPrimaryColor] = useState(club.primaryColor);
  const [clubSecondaryColor, setClubSecondaryColor] = useState(club.secondaryColor);
  const [clubAccentColor, setClubAccentColor] = useState(club.accentColor);
  const [clubContactEmail, setClubContactEmail] = useState(club.contactEmail);
  const [clubWebsiteUrl, setClubWebsiteUrl] = useState(club.websiteUrl);
  const [clubInstagramUrl, setClubInstagramUrl] = useState(club.instagramUrl);
  const [clubFacebookUrl, setClubFacebookUrl] = useState(club.facebookUrl);
  const [clubWelcomeText, setClubWelcomeText] = useState(club.welcomeText);
  const [clubFooterText, setClubFooterText] = useState(club.footerText);
  const [clubLogoUploading, setClubLogoUploading] = useState(false);
  const [clubLogoUploadMessage, setClubLogoUploadMessage] = useState<string | null>(null);
  const [clubLogoUploadError, setClubLogoUploadError] = useState<string | null>(null);

  const [allSeasons, setAllSeasons] = useState<SeasonRecord[]>([]);
  const [newSeasonName, setNewSeasonName] = useState("");
  const [newSeasonStart, setNewSeasonStart] = useState("");
  const [newSeasonEnd, setNewSeasonEnd] = useState("");
  const [newDivisionName, setNewDivisionName] = useState("");
  const [newDivisionSortOrder, setNewDivisionSortOrder] = useState("4");

  const [editingSeasonId, setEditingSeasonId] = useState("");
  const [editingSeasonName, setEditingSeasonName] = useState("");
  const [editingSeasonStart, setEditingSeasonStart] = useState("");
  const [editingSeasonEnd, setEditingSeasonEnd] = useState("");

  const [editingDivisionId, setEditingDivisionId] = useState("");
  const [editingDivisionName, setEditingDivisionName] = useState("");
  const [editingDivisionSortOrder, setEditingDivisionSortOrder] = useState("1");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [captainEmail, setCaptainEmail] = useState("");
  const [captainDisplayName, setCaptainDisplayName] = useState("");
  const [captainTeamId, setCaptainTeamId] = useState("");

  const [sponsorName, setSponsorName] = useState("");
  const [sponsorType, setSponsorType] = useState("League Sponsor");
  const [sponsorPlacement, setSponsorPlacement] = useState("homepage");
  const [sponsorLogoUrl, setSponsorLogoUrl] = useState("");
  const [sponsorWebsiteUrl, setSponsorWebsiteUrl] = useState("");
  const [sponsorSortOrder, setSponsorSortOrder] = useState("10");
  const [sponsorIsActive, setSponsorIsActive] = useState(true);
  const [sponsorLogoUploading, setSponsorLogoUploading] = useState(false);
  const [sponsorUploadError, setSponsorUploadError] = useState<string | null>(null);
  const [sponsorUploadMessage, setSponsorUploadMessage] = useState<string | null>(null);
  const [editingSponsorId, setEditingSponsorId] = useState("");

  const [seasonId, setSeasonId] = useState("");
  const [adminDivisions, setAdminDivisions] = useState<AdminDivision[]>([]);
  const [adminTeams, setAdminTeams] = useState<AdminTeam[]>([]);
  const [adminFixtures, setAdminFixtures] = useState<AdminFixture[]>([]);
  const [adminResults, setAdminResults] = useState<AdminResult[]>([]);
  const [adminSponsors, setAdminSponsors] = useState<AdminSponsor[]>([]);
  const [adminCupRules, setAdminCupRules] = useState<CupQualifierRuleRecord[]>([]);
  const [adminManualQualifiers, setAdminManualQualifiers] = useState<CupManualQualifierRecord[]>([]);
  const [cupRuleDrafts, setCupRuleDrafts] = useState<Record<string, { qualifierCount: string; isActive: boolean }>>({});
  const [manualQualifierTeamId, setManualQualifierTeamId] = useState("");
  const [manualQualifierSeed, setManualQualifierSeed] = useState("1");
  const [captainUsers, setCaptainUsers] = useState<CaptainUserRecord[]>([]);
  const [captainSubmissions, setCaptainSubmissions] = useState<CaptainSubmissionRecord[]>([]);

  const [editingTeamId, setEditingTeamId] = useState("");
  const [editingTeamName, setEditingTeamName] = useState("");
  const [editingTeamDivisionId, setEditingTeamDivisionId] = useState("");
  const [editingTeamPlayerOne, setEditingTeamPlayerOne] = useState("");
  const [editingTeamPlayerTwo, setEditingTeamPlayerTwo] = useState("");
  const [editingTeamCaptainEmail, setEditingTeamCaptainEmail] = useState("");
  const [editingTeamIsActive, setEditingTeamIsActive] = useState(true);

  const [editingFixtureId, setEditingFixtureId] = useState("");
  const [editingFixtureDivisionId, setEditingFixtureDivisionId] = useState("");
  const [editingFixtureHomeTeamId, setEditingFixtureHomeTeamId] = useState("");
  const [editingFixtureAwayTeamId, setEditingFixtureAwayTeamId] = useState("");
  const [editingFixtureWeek, setEditingFixtureWeek] = useState("");
  const [editingFixturePlayBy, setEditingFixturePlayBy] = useState("");
  const [editingFixtureCourt, setEditingFixtureCourt] = useState("");
  const [editingFixtureStatus, setEditingFixtureStatus] = useState("open");

  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDivisionId, setNewTeamDivisionId] = useState("");
  const [newTeamPlayerOne, setNewTeamPlayerOne] = useState("");
  const [newTeamPlayerTwo, setNewTeamPlayerTwo] = useState("");
  const [newTeamCaptainEmail, setNewTeamCaptainEmail] = useState("");
  const [newTeamIsActive, setNewTeamIsActive] = useState(true);

  const [fixtureDivisionId, setFixtureDivisionId] = useState("");
  const [fixtureHomeTeamId, setFixtureHomeTeamId] = useState("");
  const [fixtureAwayTeamId, setFixtureAwayTeamId] = useState("");
  const [fixtureWeek, setFixtureWeek] = useState("7");
  const [fixturePlayBy, setFixturePlayBy] = useState("");
  const [fixtureCourt, setFixtureCourt] = useState("Arrange");

  const [generatorDivisionId, setGeneratorDivisionId] = useState("");
  const [generatorScheduleType, setGeneratorScheduleType] = useState("weekly");
  const [generatorFormat, setGeneratorFormat] = useState("single");
  const [generatorStartWeek, setGeneratorStartWeek] = useState("1");
  const [generatorFirstPlayBy, setGeneratorFirstPlayBy] = useState("");
  const [generatorAvailableFrom, setGeneratorAvailableFrom] = useState("");
  const [generatorDeadline, setGeneratorDeadline] = useState("");
  const [generatorPackName, setGeneratorPackName] = useState("");
  const [generatorFixturesPerTeam, setGeneratorFixturesPerTeam] = useState("3");
  const [generatorCourt, setGeneratorCourt] = useState("Arrange");
  const [generatorClearExisting, setGeneratorClearExisting] = useState(false);

  const [resultFixtureId, setResultFixtureId] = useState("");
  const [resultType, setResultType] = useState<ResultType>("home_win");
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [resultNotes, setResultNotes] = useState("");

  function showSuccess(text: string) {
    setMessage(text);
    setErrorMessage(null);
  }

  function showError(text: string) {
    setErrorMessage(text);
    setMessage(null);
  }

  async function refreshAdminData() {
    setAdminLoading(true);
    try {
      const { data: seasonRows, error: seasonError } = await supabase
        .from("seasons")
        .select("id, name, status, starts_on, ends_on")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<SeasonRecord[]>();

      if (seasonError) throw seasonError;
      const activeSeason = seasonRows?.[0];
      if (!activeSeason) throw new Error("No active season found.");
      setSeasonId(activeSeason.id);

      const { data: allSeasonRows, error: allSeasonError } = await supabase
        .from("seasons")
        .select("id, name, status, starts_on, ends_on")
        .order("created_at", { ascending: false })
        .returns<SeasonRecord[]>();

      if (allSeasonError) throw allSeasonError;
      setAllSeasons(allSeasonRows ?? []);

      const { data: divisionRows, error: divisionError } = await supabase
        .from("divisions")
        .select("id, name, sort_order")
        .eq("season_id", activeSeason.id)
        .order("sort_order", { ascending: true })
        .returns<AdminDivision[]>();

      if (divisionError) throw divisionError;
      const divisions = divisionRows ?? [];
      setAdminDivisions(divisions);

      const divisionIds = divisions.map((division) => division.id);
      if (divisionIds.length === 0) {
        setAdminTeams([]);
        setAdminFixtures([]);
        setAdminResults([]);
        setAdminSponsors([]);
        setAdminCupRules([]);
        setAdminManualQualifiers([]);
        setCupRuleDrafts({});
        setCaptainUsers([]);
        setCaptainSubmissions([]);
        return;
      }

      const [
        teamsResponse,
        fixturesResponse,
        resultsResponse,
        sponsorsResponse,
        cupRulesResponse,
        manualQualifiersResponse,
        captainUsersResponse,
        captainSubmissionsResponse,
      ] = await Promise.all([
        supabase
          .from("teams")
          .select("id, name, division_id, player_one_name, player_two_name, captain_email, is_active")
          .in("division_id", divisionIds)
          .order("name", { ascending: true })
          .returns<AdminTeam[]>(),
        supabase
          .from("fixtures")
          .select(
            "id, week_number, play_by, court, status, division_id, home_team_id, away_team_id, fixture_group_type, fixture_group_name, available_from, fixtures_per_team",
          )
          .eq("season_id", activeSeason.id)
          .order("week_number", { ascending: false })
          .order("play_by", { ascending: true })
          .returns<AdminFixture[]>(),
        supabase
          .from("results")
          .select(
            "id, fixture_id, home_score, away_score, winner_team_id, notes, status",
          )
          .returns<AdminResult[]>(),
        supabase
          .from("sponsors")
          .select("id, name, sponsor_type, placement, logo_url, website_url, sort_order, is_active")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
          .returns<AdminSponsor[]>(),
        supabase
          .from("cup_qualifier_rules")
          .select("id, season_id, division_id, qualifier_count, sort_order, is_active")
          .eq("season_id", activeSeason.id)
          .order("sort_order", { ascending: true })
          .returns<CupQualifierRuleRecord[]>(),
        supabase
          .from("cup_manual_qualifiers")
          .select("id, season_id, team_id, seed_position, is_active")
          .eq("season_id", activeSeason.id)
          .order("seed_position", { ascending: true })
          .returns<CupManualQualifierRecord[]>(),
        supabase
          .from("captain_users")
          .select("id, email, team_id, display_name, created_at")
          .order("email", { ascending: true })
          .returns<CaptainUserRecord[]>(),
        supabase
          .from("result_submissions")
          .select(
            "id, fixture_id, submitting_team_id, submitted_by_email, home_score, away_score, winner_team_id, notes, status, opponent_confirmed_by_email, created_at",
          )
          .order("created_at", { ascending: false })
          .returns<CaptainSubmissionRecord[]>(),
      ]);

      if (teamsResponse.error) throw teamsResponse.error;
      if (fixturesResponse.error) throw fixturesResponse.error;
      if (resultsResponse.error) throw resultsResponse.error;
      if (sponsorsResponse.error) throw sponsorsResponse.error;
      if (cupRulesResponse.error) throw cupRulesResponse.error;
      if (manualQualifiersResponse.error) throw manualQualifiersResponse.error;
      if (captainUsersResponse.error) throw captainUsersResponse.error;
      if (captainSubmissionsResponse.error)
        throw captainSubmissionsResponse.error;

      setAdminTeams(teamsResponse.data ?? []);
      setAdminFixtures(fixturesResponse.data ?? []);
      setAdminResults(resultsResponse.data ?? []);
      const cupRules = cupRulesResponse.data ?? [];
      setAdminSponsors(sponsorsResponse.data ?? []);
      setAdminCupRules(cupRules);
      setAdminManualQualifiers(manualQualifiersResponse.data ?? []);
      setCupRuleDrafts(
        Object.fromEntries(
          divisions.map((division, index) => {
            const existing = cupRules.find((rule) => rule.division_id === division.id);
            return [
              division.id,
              {
                qualifierCount: String(existing?.qualifier_count ?? (index === 2 ? 2 : 3)),
                isActive: existing?.is_active ?? index < 3,
              },
            ];
          }),
        ),
      );
      setCaptainUsers(captainUsersResponse.data ?? []);
      setCaptainSubmissions(captainSubmissionsResponse.data ?? []);

      if (!newTeamDivisionId && divisions[0])
        setNewTeamDivisionId(divisions[0].id);
      if (!fixtureDivisionId && divisions[0])
        setFixtureDivisionId(divisions[0].id);
      if (!generatorDivisionId && divisions[0])
        setGeneratorDivisionId(divisions[0].id);
      if (!captainTeamId && teamsResponse.data?.[0])
        setCaptainTeamId(teamsResponse.data[0].id);
      if (!manualQualifierTeamId && teamsResponse.data?.[0])
        setManualQualifierTeamId(teamsResponse.data[0].id);
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not load admin data.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  async function checkAdminAccess() {
    const { data, error } = await supabase.rpc("is_admin");
    if (error) {
      setIsAdmin(false);
      showError(error.message);
      return false;
    }

    const allowed = data === true;
    setIsAdmin(allowed);
    if (!allowed)
      showError(
        "You are logged in, but this account is not marked as an admin yet.",
      );
    return allowed;
  }

  useEffect(() => {
    let mounted = true;

    async function loadAuth() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      const authUser = data.user
        ? { id: data.user.id, email: data.user.email ?? undefined }
        : null;
      setUser(authUser);
      setAuthLoading(false);

      if (authUser) {
        const allowed = await checkAdminAccess();
        if (allowed) await refreshAdminData();
      }
    }

    loadAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const authUser = session?.user
          ? { id: session.user.id, email: session.user.email ?? undefined }
          : null;
        setUser(authUser);
        setIsAdmin(false);
        if (authUser) {
          const allowed = await checkAdminAccess();
          if (allowed) await refreshAdminData();
        }
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setClubName(club.name);
    setClubShortName(club.shortName);
    setClubLogoUrl(club.logoUrl);
    setClubPrimaryColor(club.primaryColor);
    setClubSecondaryColor(club.secondaryColor);
    setClubAccentColor(club.accentColor);
    setClubContactEmail(club.contactEmail);
    setClubWebsiteUrl(club.websiteUrl);
    setClubInstagramUrl(club.instagramUrl);
    setClubFacebookUrl(club.facebookUrl);
    setClubWelcomeText(club.welcomeText);
    setClubFooterText(club.footerText);
  }, [club]);

  const teamsForFixtureDivision = adminTeams.filter(
    (team) => team.division_id === fixtureDivisionId,
  );
  const generatorTeams = adminTeams.filter(
    (team) => team.division_id === generatorDivisionId,
  );
  const teamById = new Map(adminTeams.map((team) => [team.id, team]));
  const divisionById = new Map(
    adminDivisions.map((division) => [division.id, division]),
  );
  const selectedResultFixture = adminFixtures.find(
    (fixture) => fixture.id === resultFixtureId,
  );
  const editingFixtureTeams = adminTeams.filter(
    (team) => team.division_id === editingFixtureDivisionId,
  );
  const resultByFixtureId = new Map(
    adminResults.map((result) => [result.fixture_id, result]),
  );
  const orderedAdminDivisions = [...adminDivisions].sort((a, b) => {
    const orderDiff = (a.sort_order ?? 999) - (b.sort_order ?? 999);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  });
  const generatorPreviewRows = getGeneratedFixtureRows();
  const generatorPreviewLastWeek = generatorPreviewRows.length
    ? Math.max(...generatorPreviewRows.map((row) => row.week_number))
    : Number(generatorStartWeek) || 1;
  const generatorPreviewRangeLabel = generatorScheduleType === "weekly"
    ? `Weeks ${generatorStartWeek || "?"}-${generatorPreviewLastWeek}`
    : generatorPackName.trim() || (generatorScheduleType === "monthly" ? "Monthly fixture pack" : "Custom fixture pack");


  async function handleClubLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setClubLogoUploadError(null);
    setClubLogoUploadMessage(null);

    const maxBytes = 1024 * 1024;
    if (file.size > maxBytes) {
      setClubLogoUploadError(`Logo must be under 1 MB. This file is ${(file.size / 1024 / 1024).toFixed(2)} MB.`);
      event.target.value = "";
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `gsm-padel/club-logo-${Date.now()}.${extension}`;

    setClubLogoUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from("club-logos")
        .upload(path, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("club-logos").getPublicUrl(path);
      setClubLogoUrl(data.publicUrl);
      setClubLogoUploadMessage("Club logo uploaded. Save club settings to publish it.");
    } catch (error) {
      setClubLogoUploadError(error instanceof Error ? error.message : "Could not upload club logo.");
    } finally {
      setClubLogoUploading(false);
      event.target.value = "";
    }
  }

  async function handleSaveClubSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clubName.trim()) {
      showError("Club name is required.");
      return;
    }

    setAdminLoading(true);
    try {
      const { error } = await supabase.from("clubs").upsert(
        {
          slug: "gsm-padel",
          name: clubName.trim(),
          short_name: clubShortName.trim() || clubName.trim(),
          logo_url: clubLogoUrl.trim() || "/gsm-logo.png",
          primary_color: clubPrimaryColor || "#2458ff",
          secondary_color: clubSecondaryColor || "#0f172a",
          accent_color: clubAccentColor || clubPrimaryColor || "#2458ff",
          contact_email: clubContactEmail.trim(),
          website_url: clubWebsiteUrl.trim() || null,
          instagram_url: clubInstagramUrl.trim() || null,
          facebook_url: clubFacebookUrl.trim() || null,
          welcome_title: `${clubName.trim()} League Hub`,
          welcome_text: clubWelcomeText.trim(),
          footer_text: clubFooterText.trim(),
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" },
      );

      if (error) throw error;
      showSuccess("Club settings saved. Refreshing public branding...");
      onDataChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not save club settings. Make sure the club settings SQL has been run.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleCreateSeason(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newSeasonName.trim()) {
      showError("Add a season name first.");
      return;
    }

    setAdminLoading(true);
    try {
      await supabase.from("seasons").update({ status: "draft" }).eq("status", "active");

      const { data: season, error: seasonError } = await supabase
        .from("seasons")
        .insert({
          name: newSeasonName.trim(),
          status: "active",
          starts_on: newSeasonStart || null,
          ends_on: newSeasonEnd || null,
        })
        .select("id, name, status, starts_on, ends_on")
        .single<SeasonRecord>();

      if (seasonError) throw seasonError;

      const defaultDivisions = [
        { season_id: season.id, name: "Division 1", sort_order: 1 },
        { season_id: season.id, name: "Division 2", sort_order: 2 },
        { season_id: season.id, name: "Division 3", sort_order: 3 },
      ];

      const { error: divisionError } = await supabase
        .from("divisions")
        .insert(defaultDivisions);

      if (divisionError) throw divisionError;

      setNewSeasonName("");
      setNewSeasonStart("");
      setNewSeasonEnd("");
      showSuccess(`Created and activated ${season.name}.`);
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not create season.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleActivateSeason(targetSeasonId: string) {
    if (!targetSeasonId) return;
    setAdminLoading(true);
    try {
      const { error: draftError } = await supabase
        .from("seasons")
        .update({ status: "draft" })
        .neq("id", targetSeasonId);
      if (draftError) throw draftError;

      const { error: activeError } = await supabase
        .from("seasons")
        .update({ status: "active" })
        .eq("id", targetSeasonId);
      if (activeError) throw activeError;

      showSuccess("Active season changed.");
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not activate season.");
    } finally {
      setAdminLoading(false);
    }
  }

  function beginEditSeason(season: SeasonRecord) {
    setEditingSeasonId(season.id);
    setEditingSeasonName(season.name);
    setEditingSeasonStart(season.starts_on ?? "");
    setEditingSeasonEnd(season.ends_on ?? "");
  }

  function cancelEditSeason() {
    setEditingSeasonId("");
    setEditingSeasonName("");
    setEditingSeasonStart("");
    setEditingSeasonEnd("");
  }

  async function handleUpdateSeason(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSeasonId || !editingSeasonName.trim()) {
      showError("Choose a season and add a name first.");
      return;
    }

    setAdminLoading(true);
    try {
      const { error } = await supabase
        .from("seasons")
        .update({
          name: editingSeasonName.trim(),
          starts_on: editingSeasonStart || null,
          ends_on: editingSeasonEnd || null,
        })
        .eq("id", editingSeasonId);
      if (error) throw error;

      showSuccess("Season updated.");
      cancelEditSeason();
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not update season.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleArchiveSeason(season: SeasonRecord) {
    if (season.status === "active") {
      showError("Make another season active before archiving this season.");
      return;
    }
    if (!window.confirm(`Archive ${season.name}? It will be hidden from active season controls.`)) return;
    setAdminLoading(true);
    try {
      const { error } = await supabase
        .from("seasons")
        .update({ status: "archived" })
        .eq("id", season.id);
      if (error) throw error;
      showSuccess("Season archived.");
      await refreshAdminData();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not archive season.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleDeleteSeason(season: SeasonRecord) {
    if (season.status === "active") {
      showError("You cannot delete the active season. Activate another season first.");
      return;
    }
    if (!window.confirm(`Delete ${season.name}? This deletes that season setup and cannot be undone.`)) return;
    setAdminLoading(true);
    try {
      const { error } = await supabase.from("seasons").delete().eq("id", season.id);
      if (error) throw error;
      showSuccess("Season deleted.");
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not delete season. It may still have linked data.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleAddDivision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!seasonId || !newDivisionName.trim()) {
      showError("Add a division name first.");
      return;
    }

    const nextSortOrder =
      adminDivisions.length > 0
        ? Math.max(...adminDivisions.map((division) => division.sort_order || 0)) + 1
        : 1;

    setAdminLoading(true);
    try {
      const { error } = await supabase.from("divisions").insert({
        season_id: seasonId,
        name: newDivisionName.trim(),
        sort_order: Number(newDivisionSortOrder) || nextSortOrder,
      });
      if (error) throw error;
      setNewDivisionName("");
      setNewDivisionSortOrder(String(nextSortOrder + 1));
      showSuccess("Division added. You can now move it up or down in the list.");
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not add division.");
    } finally {
      setAdminLoading(false);
    }
  }

  function beginEditDivision(division: AdminDivision) {
    setEditingDivisionId(division.id);
    setEditingDivisionName(division.name);
    setEditingDivisionSortOrder(String(division.sort_order ?? 1));
  }

  function cancelEditDivision() {
    setEditingDivisionId("");
    setEditingDivisionName("");
    setEditingDivisionSortOrder("1");
  }

  async function handleUpdateDivision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDivisionId || !editingDivisionName.trim()) {
      showError("Choose a league/division and add a name.");
      return;
    }

    setAdminLoading(true);
    try {
      const { error } = await supabase
        .from("divisions")
        .update({
          name: editingDivisionName.trim(),
          sort_order: Number(editingDivisionSortOrder) || 1,
        })
        .eq("id", editingDivisionId);
      if (error) throw error;

      showSuccess("League/division updated.");
      cancelEditDivision();
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not update league/division.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleDeleteDivision(division: AdminDivision) {
    const hasTeams = adminTeams.some((team) => team.division_id === division.id);
    const hasFixtures = adminFixtures.some((fixture) => fixture.division_id === division.id);
    if (hasTeams || hasFixtures) {
      showError("This league has teams or fixtures attached. Move/delete those first before deleting the league.");
      return;
    }
    if (!window.confirm(`Delete ${division.name}?`)) return;
    setAdminLoading(true);
    try {
      const { error } = await supabase.from("divisions").delete().eq("id", division.id);
      if (error) throw error;
      showSuccess("League/division deleted.");
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not delete league/division.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function saveDivisionOrder(nextOrder: AdminDivision[]) {
    setAdminLoading(true);
    try {
      const updates = nextOrder.map((division, index) =>
        supabase
          .from("divisions")
          .update({ sort_order: index + 1 })
          .eq("id", division.id),
      );

      const responses = await Promise.all(updates);
      const failed = responses.find((response) => response.error);
      if (failed?.error) throw failed.error;

      showSuccess("Division order updated.");
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not update division order.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleMoveDivision(divisionId: string, direction: "up" | "down") {
    const currentOrder = [...orderedAdminDivisions];
    const currentIndex = currentOrder.findIndex((division) => division.id === divisionId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

    const nextOrder = [...currentOrder];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [
      nextOrder[targetIndex],
      nextOrder[currentIndex],
    ];

    await saveDivisionOrder(nextOrder);
  }

  async function handleNormaliseDivisionOrder() {
    if (orderedAdminDivisions.length === 0) return;
    await saveDivisionOrder(orderedAdminDivisions);
  }

  function resetSponsorForm() {
    setSponsorName("");
    setSponsorType("League Sponsor");
    setSponsorPlacement("homepage");
    setSponsorLogoUrl("");
    setSponsorWebsiteUrl("");
    setSponsorSortOrder("10");
    setSponsorIsActive(true);
    setSponsorUploadError(null);
    setSponsorUploadMessage(null);
    setEditingSponsorId("");
  }

  function beginEditSponsor(sponsor: AdminSponsor) {
    setEditingSponsorId(sponsor.id);
    setSponsorName(sponsor.name);
    setSponsorType(sponsor.sponsor_type ?? "Sponsor");
    setSponsorPlacement(sponsor.placement ?? "homepage");
    setSponsorLogoUrl(sponsor.logo_url ?? "");
    setSponsorWebsiteUrl(sponsor.website_url ?? "");
    setSponsorSortOrder(String(sponsor.sort_order ?? 10));
    setSponsorIsActive(sponsor.is_active ?? true);
    setSponsorUploadError(null);
    setSponsorUploadMessage(null);
  }

  async function handleSponsorLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSponsorUploadError(null);
    setSponsorUploadMessage(null);
    setErrorMessage(null);
    setMessage(null);

    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      setSponsorUploadError("Logo must be PNG, JPG, WebP or SVG.");
      event.target.value = "";
      return;
    }

    const maxLogoSizeBytes = 1024 * 1024;
    if (file.size > maxLogoSizeBytes) {
      const fileSizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setSponsorUploadError(
        `Logo must be under 1 MB. This file is ${fileSizeMb} MB. Compress it or upload the 1200 × 600 sponsor version.`
      );
      event.target.value = "";
      return;
    }

    setSponsorLogoUploading(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "png";
      const safeName = (sponsorName || "sponsor")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "sponsor";
      const uniqueId = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now());
      const filePath = `${safeName}/${uniqueId}.${extension}`;

      const { error } = await supabase.storage
        .from("sponsor-logos")
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

      if (error) throw error;

      const { data } = supabase.storage.from("sponsor-logos").getPublicUrl(filePath);
      setSponsorLogoUrl(data.publicUrl);
      setSponsorUploadMessage("Logo uploaded. Save the sponsor to keep it attached.");
    } catch (error) {
      setSponsorUploadError(error instanceof Error ? error.message : "Could not upload sponsor logo.");
    } finally {
      setSponsorLogoUploading(false);
      event.target.value = "";
    }
  }

  async function handleSaveSponsor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sponsorName.trim()) {
      showError("Add a sponsor name first.");
      return;
    }

    setAdminLoading(true);
    try {
      const payload = {
        name: sponsorName.trim(),
        sponsor_type: sponsorType.trim() || null,
        placement: sponsorPlacement,
        logo_url: sponsorLogoUrl.trim() || null,
        website_url: sponsorWebsiteUrl.trim() || null,
        sort_order: Number(sponsorSortOrder) || 10,
        is_active: sponsorIsActive,
      };

      const query = editingSponsorId
        ? supabase.from("sponsors").update(payload).eq("id", editingSponsorId)
        : supabase.from("sponsors").insert(payload);

      const { error } = await query;
      if (error) throw error;

      showSuccess(editingSponsorId ? "Sponsor updated." : "Sponsor added.");
      resetSponsorForm();
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not save sponsor.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleDeleteSponsor(sponsor: AdminSponsor) {
    if (!window.confirm(`Delete sponsor ${sponsor.name}?`)) return;
    setAdminLoading(true);
    try {
      const { error } = await supabase.from("sponsors").delete().eq("id", sponsor.id);
      if (error) throw error;
      showSuccess("Sponsor deleted.");
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not delete sponsor.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleToggleSponsorActive(sponsor: AdminSponsor) {
    setAdminLoading(true);
    try {
      const { error } = await supabase
        .from("sponsors")
        .update({ is_active: !(sponsor.is_active ?? true) })
        .eq("id", sponsor.id);
      if (error) throw error;
      showSuccess("Sponsor status updated.");
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not update sponsor.");
    } finally {
      setAdminLoading(false);
    }
  }

  function updateCupRuleDraft(divisionId: string, patch: Partial<{ qualifierCount: string; isActive: boolean }>) {
    setCupRuleDrafts((current) => ({
      ...current,
      [divisionId]: {
        qualifierCount: current[divisionId]?.qualifierCount ?? "0",
        isActive: current[divisionId]?.isActive ?? true,
        ...patch,
      },
    }));
  }

  async function handleSaveCupRule(division: AdminDivision) {
    const draft = cupRuleDrafts[division.id] ?? { qualifierCount: "0", isActive: true };
    const qualifierCount = Number.parseInt(draft.qualifierCount, 10);

    if (!seasonId) return showError("No active season found.");
    if (!Number.isFinite(qualifierCount) || qualifierCount < 0)
      return showError("Qualifier count must be 0 or higher.");

    setAdminLoading(true);
    try {
      const { error } = await supabase.from("cup_qualifier_rules").upsert(
        {
          season_id: seasonId,
          division_id: division.id,
          qualifier_count: qualifierCount,
          sort_order: division.sort_order,
          is_active: draft.isActive,
        },
        { onConflict: "season_id,division_id" },
      );

      if (error) throw error;
      await refreshAdminData();
      onDataChanged();
      showSuccess("League Cup qualification rule saved.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not save cup rule.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleAddManualQualifier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const seed = Number.parseInt(manualQualifierSeed, 10);
    if (!seasonId) return showError("No active season found.");
    if (!manualQualifierTeamId) return showError("Choose a team to add as a qualifier.");
    if (!Number.isFinite(seed) || seed < 1) return showError("Seed position must be 1 or higher.");

    setAdminLoading(true);
    try {
      const { error } = await supabase.from("cup_manual_qualifiers").upsert(
        {
          season_id: seasonId,
          team_id: manualQualifierTeamId,
          seed_position: seed,
          is_active: true,
        },
        { onConflict: "season_id,team_id" },
      );

      if (error) throw error;
      setManualQualifierSeed(String(seed + 1));
      await refreshAdminData();
      onDataChanged();
      showSuccess("Manual League Cup qualifier added.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not add manual qualifier.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleDeleteManualQualifier(qualifier: CupManualQualifierRecord) {
    if (!window.confirm("Remove this manual qualifier?")) return;

    setAdminLoading(true);
    try {
      const { error } = await supabase
        .from("cup_manual_qualifiers")
        .delete()
        .eq("id", qualifier.id);

      if (error) throw error;
      await refreshAdminData();
      onDataChanged();
      showSuccess("Manual qualifier removed.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not remove qualifier.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleClearManualQualifiers() {
    if (!seasonId) return showError("No active season found.");
    if (!window.confirm("Clear all manual League Cup qualifiers and return to automatic qualification?")) return;

    setAdminLoading(true);
    try {
      const { error } = await supabase
        .from("cup_manual_qualifiers")
        .delete()
        .eq("season_id", seasonId);

      if (error) throw error;
      await refreshAdminData();
      onDataChanged();
      showSuccess("Manual qualifiers cleared. Cup is using automatic qualification again.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not clear manual qualifiers.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      showSuccess("Logged in successfully.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    showSuccess("Logged out.");
  }

  async function handleAddTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!seasonId || !newTeamDivisionId || !newTeamName.trim()) {
      showError("Add a team name and choose a division.");
      return;
    }

    setAdminLoading(true);
    try {
      const { data: team, error: teamError } = await supabase
        .from("teams")
        .insert({
          division_id: newTeamDivisionId,
          name: newTeamName.trim(),
          player_one_name: newTeamPlayerOne.trim() || null,
          player_two_name: newTeamPlayerTwo.trim() || null,
          captain_email: newTeamCaptainEmail.trim().toLowerCase() || null,
          is_active: newTeamIsActive,
        })
        .select("id, name, division_id, player_one_name, player_two_name, captain_email, is_active")
        .single<AdminTeam>();

      if (teamError) throw teamError;

      const { error: standingError } = await supabase.from("standings").insert({
        season_id: seasonId,
        division_id: newTeamDivisionId,
        team_id: team.id,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        score_diff: 0,
        points: 0,
      });

      if (standingError) throw standingError;

      setNewTeamName("");
      setNewTeamPlayerOne("");
      setNewTeamPlayerTwo("");
      setNewTeamCaptainEmail("");
      setNewTeamIsActive(true);
      showSuccess(`Added ${team.name}.`);
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not add team.");
    } finally {
      setAdminLoading(false);
    }
  }

  function beginEditTeam(team: AdminTeam) {
    setEditingTeamId(team.id);
    setEditingTeamName(team.name);
    setEditingTeamDivisionId(team.division_id);
    setEditingTeamPlayerOne(team.player_one_name ?? "");
    setEditingTeamPlayerTwo(team.player_two_name ?? "");
    setEditingTeamCaptainEmail(team.captain_email ?? "");
    setEditingTeamIsActive(team.is_active ?? true);
  }

  function cancelEditTeam() {
    setEditingTeamId("");
    setEditingTeamName("");
    setEditingTeamDivisionId("");
    setEditingTeamPlayerOne("");
    setEditingTeamPlayerTwo("");
    setEditingTeamCaptainEmail("");
    setEditingTeamIsActive(true);
  }

  async function handleUpdateTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTeamId || !editingTeamName.trim() || !editingTeamDivisionId) {
      showError("Choose a team and complete the edit fields.");
      return;
    }

    setAdminLoading(true);
    try {
      const { error } = await supabase
        .from("teams")
        .update({
          name: editingTeamName.trim(),
          division_id: editingTeamDivisionId,
          player_one_name: editingTeamPlayerOne.trim() || null,
          player_two_name: editingTeamPlayerTwo.trim() || null,
          captain_email: editingTeamCaptainEmail.trim().toLowerCase() || null,
          is_active: editingTeamIsActive,
        })
        .eq("id", editingTeamId);

      if (error) throw error;

      const { error: standingError } = await supabase
        .from("standings")
        .update({
          division_id: editingTeamDivisionId,
          updated_at: new Date().toISOString(),
        })
        .eq("season_id", seasonId)
        .eq("team_id", editingTeamId);

      if (standingError) throw standingError;

      showSuccess("Team updated.");
      cancelEditTeam();
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not update team.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleDeleteTeam(team: AdminTeam) {
    const hasFixtures = adminFixtures.some(
      (fixture) =>
        fixture.home_team_id === team.id || fixture.away_team_id === team.id,
    );
    if (hasFixtures) {
      showError(
        "This team has fixtures attached. Delete or reassign those fixtures first.",
      );
      return;
    }

    if (!window.confirm(`Delete ${team.name}? This cannot be undone.`)) return;

    setAdminLoading(true);
    try {
      await supabase
        .from("standings")
        .delete()
        .eq("season_id", seasonId)
        .eq("team_id", team.id);
      const { error } = await supabase.from("teams").delete().eq("id", team.id);
      if (error) throw error;
      showSuccess("Team deleted.");
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not delete team.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleAddFixture(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !seasonId ||
      !fixtureDivisionId ||
      !fixtureHomeTeamId ||
      !fixtureAwayTeamId ||
      !fixtureWeek ||
      !fixturePlayBy
    ) {
      showError("Complete all fixture fields.");
      return;
    }

    if (fixtureHomeTeamId === fixtureAwayTeamId) {
      showError("Home and away teams must be different.");
      return;
    }

    setAdminLoading(true);
    try {
      const { error } = await supabase.from("fixtures").insert({
        season_id: seasonId,
        division_id: fixtureDivisionId,
        week_number: Number(fixtureWeek),
        home_team_id: fixtureHomeTeamId,
        away_team_id: fixtureAwayTeamId,
        play_by: fixturePlayBy,
        court: fixtureCourt.trim() || "Arrange",
        status: "open",
      });

      if (error) throw error;

      showSuccess("Fixture added.");
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not add fixture.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  function beginEditFixture(fixture: AdminFixture) {
    setEditingFixtureId(fixture.id);
    setEditingFixtureDivisionId(fixture.division_id);
    setEditingFixtureHomeTeamId(fixture.home_team_id);
    setEditingFixtureAwayTeamId(fixture.away_team_id);
    setEditingFixtureWeek(String(fixture.week_number));
    setEditingFixturePlayBy(fixture.play_by);
    setEditingFixtureCourt(fixture.court ?? "Arrange");
    setEditingFixtureStatus(fixture.status);
  }

  function cancelEditFixture() {
    setEditingFixtureId("");
    setEditingFixtureDivisionId("");
    setEditingFixtureHomeTeamId("");
    setEditingFixtureAwayTeamId("");
    setEditingFixtureWeek("");
    setEditingFixturePlayBy("");
    setEditingFixtureCourt("");
    setEditingFixtureStatus("open");
  }

  async function recalculateStandings() {
    if (!seasonId) return;
    const { error } = await supabase.rpc("recalculate_standings_for_season", {
      p_season_id: seasonId,
    });
    if (error) throw error;
  }

  async function handleLoadFullDemo() {
    const confirmed = window.confirm(
      "Load full demo data for the active club/season? This replaces demo teams, fixtures, results, standings and demo sponsors for the active season.",
    );
    if (!confirmed) return;

    setAdminLoading(true);
    try {
      const { error } = await supabase.rpc("load_demo_club_data");
      if (error) throw error;
      showSuccess("Demo club data loaded. The public site now has demo teams, fixtures, results, standings and sponsors.");
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not load demo data.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleResetDemoData() {
    const confirmed = window.confirm(
      "Reset demo data for the active club/season? This removes demo teams, fixtures, results, standings, captain links and demo sponsors.",
    );
    if (!confirmed) return;

    setAdminLoading(true);
    try {
      const { error } = await supabase.rpc("reset_demo_data");
      if (error) throw error;
      showSuccess("Demo data reset for the active club/season.");
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not reset demo data.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleUpdateFixture(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !editingFixtureId ||
      !editingFixtureDivisionId ||
      !editingFixtureHomeTeamId ||
      !editingFixtureAwayTeamId ||
      !editingFixtureWeek ||
      !editingFixturePlayBy
    ) {
      showError("Complete all fixture edit fields.");
      return;
    }

    if (editingFixtureHomeTeamId === editingFixtureAwayTeamId) {
      showError("Home and away teams must be different.");
      return;
    }

    setAdminLoading(true);
    try {
      const { error } = await supabase
        .from("fixtures")
        .update({
          division_id: editingFixtureDivisionId,
          week_number: Number(editingFixtureWeek),
          home_team_id: editingFixtureHomeTeamId,
          away_team_id: editingFixtureAwayTeamId,
          play_by: editingFixturePlayBy,
          court: editingFixtureCourt.trim() || "Arrange",
          status: editingFixtureStatus,
        })
        .eq("id", editingFixtureId);

      if (error) throw error;
      await recalculateStandings();
      showSuccess("Fixture updated and standings recalculated.");
      cancelEditFixture();
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not update fixture.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleDeleteFixture(fixture: AdminFixture) {
    const home = teamById.get(fixture.home_team_id)?.name ?? "Home";
    const away = teamById.get(fixture.away_team_id)?.name ?? "Away";
    if (
      !window.confirm(
        `Delete fixture: ${home} vs ${away}? Any result for this fixture will also be deleted.`,
      )
    )
      return;

    setAdminLoading(true);
    try {
      const { error } = await supabase
        .from("fixtures")
        .delete()
        .eq("id", fixture.id);
      if (error) throw error;
      await recalculateStandings();
      showSuccess("Fixture deleted and standings recalculated.");
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not delete fixture.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleSubmitResult(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fixture = selectedResultFixture;
    if (!fixture) {
      showError("Choose a fixture first.");
      return;
    }

    setAdminLoading(true);
    try {
      const homeWins =
        resultType === "home_win" || resultType === "away_forfeit";
      const awayWins =
        resultType === "away_win" || resultType === "home_forfeit";
      const doubleForfeit = resultType === "double_forfeit";
      const winnerTeamId = homeWins
        ? fixture.home_team_id
        : awayWins
          ? fixture.away_team_id
          : null;
      const fixtureStatus = doubleForfeit
        ? "double_forfeit"
        : resultType.includes("forfeit")
          ? "forfeit"
          : "confirmed";

      if (
        !doubleForfeit &&
        !resultType.includes("forfeit") &&
        (!homeScore.trim() || !awayScore.trim())
      ) {
        throw new Error("Add the home and away score for normal results.");
      }

      const resultPayload = {
        fixture_id: fixture.id,
        home_score: doubleForfeit
          ? "Double forfeit"
          : resultType === "home_forfeit"
            ? "Forfeit"
            : homeScore.trim(),
        away_score: doubleForfeit
          ? "Double forfeit"
          : resultType === "away_forfeit"
            ? "Forfeit"
            : awayScore.trim(),
        winner_team_id: winnerTeamId,
        notes: resultNotes.trim() || null,
        status:
          resultType.includes("forfeit") || doubleForfeit
            ? "admin_override"
            : "confirmed",
        confirmed_at: new Date().toISOString(),
      };

      const existingResult = resultByFixtureId.get(fixture.id);

      if (existingResult) {
        const { error: updateError } = await supabase
          .from("results")
          .update(resultPayload)
          .eq("id", existingResult.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("results")
          .insert(resultPayload);
        if (insertError) throw insertError;
      }

      const { error: fixtureError } = await supabase
        .from("fixtures")
        .update({ status: fixtureStatus })
        .eq("id", fixture.id);
      if (fixtureError) throw fixtureError;

      await recalculateStandings();

      setHomeScore("");
      setAwayScore("");
      setResultNotes("");
      showSuccess(
        existingResult
          ? "Result updated and standings recalculated."
          : "Result saved and standings recalculated.",
      );
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not submit result.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleDeleteResult(result: AdminResult) {
    if (!window.confirm("Delete this result and recalculate the table?"))
      return;

    setAdminLoading(true);
    try {
      const { error } = await supabase
        .from("results")
        .delete()
        .eq("id", result.id);
      if (error) throw error;

      const { error: fixtureError } = await supabase
        .from("fixtures")
        .update({ status: "open" })
        .eq("id", result.fixture_id);
      if (fixtureError) throw fixtureError;

      await recalculateStandings();
      showSuccess("Result deleted and standings recalculated.");
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not delete result.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  function loadResultIntoForm(result: AdminResult) {
    const fixture = adminFixtures.find((item) => item.id === result.fixture_id);
    if (!fixture) return;

    setResultFixtureId(result.fixture_id);
    setHomeScore(result.home_score ?? "");
    setAwayScore(result.away_score ?? "");
    setResultNotes(result.notes ?? "");

    if (fixture.status === "double_forfeit") setResultType("double_forfeit");
    else if (
      result.winner_team_id === fixture.home_team_id &&
      result.away_score === "Forfeit"
    )
      setResultType("away_forfeit");
    else if (
      result.winner_team_id === fixture.away_team_id &&
      result.home_score === "Forfeit"
    )
      setResultType("home_forfeit");
    else if (result.winner_team_id === fixture.away_team_id)
      setResultType("away_win");
    else setResultType("home_win");

    showSuccess(
      "Result loaded into the form. Make your changes and press Save Result.",
    );
  }

  async function handleAssignCaptain(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captainEmail.trim() || !captainTeamId) {
      showError("Add a captain email and choose a team.");
      return;
    }

    setAdminLoading(true);
    try {
      const { error } = await supabase.from("captain_users").upsert(
        {
          email: captainEmail.trim().toLowerCase(),
          display_name: captainDisplayName.trim() || null,
          team_id: captainTeamId,
        },
        { onConflict: "email" },
      );
      if (error) throw error;

      const { error: teamCaptainError } = await supabase
        .from("teams")
        .update({ captain_email: captainEmail.trim().toLowerCase() })
        .eq("id", captainTeamId);
      if (teamCaptainError) throw teamCaptainError;

      showSuccess("Captain assigned. Make sure this email also has a Supabase Auth user.");
      setCaptainEmail("");
      setCaptainDisplayName("");
      await refreshAdminData();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not assign captain.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleDeleteCaptain(captain: CaptainUserRecord) {
    if (!window.confirm(`Remove captain access for ${captain.email}?`)) return;
    setAdminLoading(true);
    try {
      const { error } = await supabase
        .from("captain_users")
        .delete()
        .eq("id", captain.id);
      if (error) throw error;

      await supabase
        .from("teams")
        .update({ captain_email: null })
        .eq("id", captain.team_id)
        .eq("captain_email", captain.email);

      showSuccess("Captain removed.");
      await refreshAdminData();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not remove captain.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleApproveSubmission(submission: CaptainSubmissionRecord) {
    const fixture = adminFixtures.find((item) => item.id === submission.fixture_id);
    if (!fixture) {
      showError("Fixture not found for this submission.");
      return;
    }

    if (!window.confirm("Approve this captain submission and update the league table?")) return;

    setAdminLoading(true);
    try {
      const { error: resultError } = await supabase.from("results").upsert(
        {
          fixture_id: submission.fixture_id,
          home_score: submission.home_score,
          away_score: submission.away_score,
          winner_team_id: submission.winner_team_id,
          notes: submission.notes,
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        },
        { onConflict: "fixture_id" },
      );
      if (resultError) throw resultError;

      const { error: fixtureError } = await supabase
        .from("fixtures")
        .update({ status: "confirmed" })
        .eq("id", submission.fixture_id);
      if (fixtureError) throw fixtureError;

      const { error: submissionError } = await supabase
        .from("result_submissions")
        .update({ status: "admin_approved", updated_at: new Date().toISOString() })
        .eq("id", submission.id);
      if (submissionError) throw submissionError;

      await recalculateStandings();
      showSuccess("Captain submission approved and standings recalculated.");
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not approve submission.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleDisputeSubmission(submission: CaptainSubmissionRecord) {
    setAdminLoading(true);
    try {
      const { error: submissionError } = await supabase
        .from("result_submissions")
        .update({ status: "disputed", updated_at: new Date().toISOString() })
        .eq("id", submission.id);
      if (submissionError) throw submissionError;

      const { error: fixtureError } = await supabase
        .from("fixtures")
        .update({ status: "disputed" })
        .eq("id", submission.fixture_id);
      if (fixtureError) throw fixtureError;

      showSuccess("Submission marked as disputed.");
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not dispute submission.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleDeleteSubmission(submission: CaptainSubmissionRecord) {
    if (!window.confirm("Delete this captain submission?")) return;
    setAdminLoading(true);
    try {
      const { error } = await supabase
        .from("result_submissions")
        .delete()
        .eq("id", submission.id);
      if (error) throw error;
      showSuccess("Captain submission deleted.");
      await refreshAdminData();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not delete submission.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  function addDaysToDate(value: string, days: number) {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function buildRoundRobinPairs(teamIds: string[]) {
    const ids: Array<string | null> = [...teamIds];
    if (ids.length % 2 === 1) ids.push(null);

    const rounds: Array<Array<[string, string]>> = [];
    const roundCount = ids.length - 1;
    const matchesPerRound = ids.length / 2;
    let rotation = [...ids];

    for (let round = 0; round < roundCount; round += 1) {
      const roundMatches: Array<[string, string]> = [];
      for (let index = 0; index < matchesPerRound; index += 1) {
        const first = rotation[index];
        const second = rotation[rotation.length - 1 - index];
        if (!first || !second) continue;

        const flipHomeAway = round % 2 === 1;
        roundMatches.push(flipHomeAway ? [second, first] : [first, second]);
      }

      rounds.push(roundMatches);
      const fixed = rotation[0];
      const rest = rotation.slice(1);
      const last = rest.pop();
      rotation = [fixed, last ?? null, ...rest];
    }

    return rounds;
  }

  function getMonthPackName(deadline: string) {
    if (!deadline) return "Monthly Fixture Pack";
    const date = new Date(`${deadline}T12:00:00`);
    return `${date.toLocaleString("en-GB", { month: "long" })} Fixture Pack`;
  }

  function getGeneratedFixtureRows(): GeneratedFixtureRow[] {
    const startWeek = Number(generatorStartWeek);
    const deadline = generatorScheduleType === "weekly" ? generatorFirstPlayBy : generatorDeadline;
    const availableFrom = generatorScheduleType === "weekly" ? generatorFirstPlayBy : (generatorAvailableFrom || generatorFirstPlayBy || generatorDeadline);
    if (!seasonId || !generatorDivisionId || !deadline) return [];
    if (!Number.isFinite(startWeek) || startWeek < 1) return [];
    if (generatorTeams.length < 2) return [];

    const baseRounds = buildRoundRobinPairs(generatorTeams.map((team) => team.id));
    const rounds = generatorFormat === "double"
      ? [
          ...baseRounds,
          ...baseRounds.map((round) =>
            round.map(([homeTeamId, awayTeamId]) => [awayTeamId, homeTeamId] as [string, string]),
          ),
        ]
      : baseRounds;

    if (generatorScheduleType === "monthly" || generatorScheduleType === "custom") {
      const targetFixturesPerTeam = Math.max(1, Number(generatorFixturesPerTeam) || 3);
      const selectedRounds = rounds.slice(0, targetFixturesPerTeam);
      const packName = generatorPackName.trim() || (generatorScheduleType === "monthly" ? getMonthPackName(deadline) : `Fixture Pack ${startWeek}`);

      return selectedRounds.flatMap((matches, roundIndex) =>
        matches.map(([homeTeamId, awayTeamId]) => ({
          season_id: seasonId,
          division_id: generatorDivisionId,
          week_number: startWeek,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          play_by: deadline,
          court: generatorCourt.trim() || "Arrange",
          status: "open",
          fixture_group_type: generatorScheduleType,
          fixture_group_name: packName,
          available_from: availableFrom || null,
          fixtures_per_team: targetFixturesPerTeam,
          home_name: teamById.get(homeTeamId)?.name ?? "Home team",
          away_name: teamById.get(awayTeamId)?.name ?? "Away team",
        })),
      );
    }

    return rounds.flatMap((matches, roundIndex) =>
      matches.map(([homeTeamId, awayTeamId]) => ({
        season_id: seasonId,
        division_id: generatorDivisionId,
        week_number: startWeek + roundIndex,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        play_by: addDaysToDate(generatorFirstPlayBy, roundIndex * 7),
        court: generatorCourt.trim() || "Arrange",
        status: "open",
        fixture_group_type: "weekly",
        fixture_group_name: `Week ${startWeek + roundIndex}`,
        available_from: null,
        fixtures_per_team: null,
        home_name: teamById.get(homeTeamId)?.name ?? "Home team",
        away_name: teamById.get(awayTeamId)?.name ?? "Away team",
      })),
    );
  }

  async function handleGenerateFixtures(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const deadline = generatorScheduleType === "weekly" ? generatorFirstPlayBy : generatorDeadline;
    if (!seasonId || !generatorDivisionId || !deadline) {
      showError(generatorScheduleType === "weekly"
        ? "Choose a league, format, starting fixture week and first fixture deadline."
        : "Choose a league, pack type, fixture pack deadline and fixtures per team.");
      return;
    }

    const startWeek = Number(generatorStartWeek);
    if (!Number.isFinite(startWeek) || startWeek < 1) {
      showError("Starting fixture week/pack number must be 1 or higher.");
      return;
    }

    if (generatorScheduleType !== "weekly") {
      const fixturesPerTeam = Number(generatorFixturesPerTeam);
      if (!Number.isFinite(fixturesPerTeam) || fixturesPerTeam < 1) {
        showError("Fixtures per team must be 1 or higher.");
        return;
      }
    }

    if (generatorTeams.length < 2) {
      showError("You need at least 2 teams in this league to generate fixtures.");
      return;
    }

    const previewRows = getGeneratedFixtureRows();
    if (previewRows.length === 0) {
      showError("No fixtures could be generated. Check your setup.");
      return;
    }

    const rows = previewRows.map(({ home_name, away_name, ...row }) => row);
    const divisionName = divisionById.get(generatorDivisionId)?.name ?? "this league";
    const lastWeek = Math.max(...previewRows.map((row) => row.week_number));
    const groupName = previewRows[0]?.fixture_group_name ?? "Fixture Pack";
    const clearText = generatorClearExisting
      ? generatorScheduleType === "weekly"
        ? `\n\nThis will also delete existing fixtures for ${divisionName} from week ${startWeek} to ${lastWeek}.`
        : `\n\nThis will also delete existing fixtures for ${divisionName} in ${groupName}.`
      : "";
    const summaryText = generatorScheduleType === "weekly"
      ? `Generate ${rows.length} fixtures for ${divisionName}, weeks ${startWeek}-${lastWeek}?${clearText}`
      : `Generate ${rows.length} fixtures for ${divisionName} in ${groupName}?\n\nTeams can play these fixtures in any order before ${deadline}.${clearText}`;

    if (!window.confirm(summaryText)) {
      return;
    }

    setAdminLoading(true);
    try {
      if (generatorClearExisting) {
        let deleteQuery = supabase
          .from("fixtures")
          .delete()
          .eq("season_id", seasonId)
          .eq("division_id", generatorDivisionId);

        if (generatorScheduleType === "weekly") {
          deleteQuery = deleteQuery.gte("week_number", startWeek).lte("week_number", lastWeek);
        } else {
          deleteQuery = deleteQuery.eq("fixture_group_name", groupName);
        }

        const { error: deleteError } = await deleteQuery;
        if (deleteError) throw deleteError;
      }

      const { error } = await supabase.from("fixtures").insert(rows);
      if (error) throw error;

      showSuccess(generatorScheduleType === "weekly"
        ? `Generated ${rows.length} weekly fixtures for ${divisionName}.`
        : `Generated ${rows.length} fixture-pack matches for ${divisionName}.`);
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Could not generate fixtures.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleManualRecalculate() {
    setAdminLoading(true);
    try {
      await recalculateStandings();
      showSuccess("Standings recalculated from saved results.");
      await refreshAdminData();
      onDataChanged();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Could not recalculate standings.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  if (authLoading) {
    return (
      <PageShell
        icon={Settings}
        title="Admin Dashboard"
        subtitle="Checking admin session..."
      >
        <Card>
          <p className="empty-state">Loading admin...</p>
        </Card>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell
        icon={Lock}
        title="Admin Login"
        subtitle="Sign in to manage teams, fixtures and results."
      >
        <div className="admin-grid">
          <Card>
            <SectionTitle icon={Lock} title="Admin Sign In" />
            <form className="admin-form" onSubmit={handleLogin}>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@email.com"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                Login
              </button>
            </form>
            {message && <p className="success-box">{message}</p>}
            {errorMessage && <p className="error-box">{errorMessage}</p>}
          </Card>
          <Card dark>
            <Lock size={52} />
            <h2>Protected Admin Area</h2>
            <p>
              Create your admin user in Supabase Authentication first, then add
              that user to the admin_users table using the SQL I gave you.
            </p>
          </Card>
        </div>
      </PageShell>
    );
  }

  if (!isAdmin) {
    return (
      <PageShell
        icon={Lock}
        title="Admin Access Required"
        subtitle="This account is logged in but not approved as an admin."
      >
        <Card>
          <p className="error-box">
            {errorMessage ?? "Your user is not listed in admin_users yet."}
          </p>
          <p className="empty-state">
            Logged in as {user.email}. Add this email to admin_users in
            Supabase, then refresh.
          </p>
          <button className="secondary-admin-button" onClick={handleLogout}>
            Logout
          </button>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      icon={Settings}
      title="Admin Dashboard"
      subtitle="Working organiser controls connected to Supabase."
    >
      <div className="admin-topbar">
        <div>
          <strong>Logged in:</strong> {user.email}
          <span>{fixtures.length} public fixtures loaded</span>
        </div>
        <div className="admin-topbar-actions">
          <button onClick={handleManualRecalculate}>
            <RefreshCw size={16} /> Recalculate
          </button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>
      {message && <p className="success-box">{message}</p>}
      {errorMessage && <p className="error-box">{errorMessage}</p>}
      {adminLoading && <p className="info-box">Working...</p>}

      <div className="admin-tabs">
        {[
          ["overview", "Overview"],
          ["settings", "Club Settings"],
          ["setup", "Seasons & Leagues"],
          ["quick", "Quick Add"],
          ["fixtures", "Fixture Generator"],
          ["captains", "Captains"],
          ["cup", "League Cup"],
          ["sponsors", "Sponsors"],
          ["demo", "Demo Tools"],
          ["manage", "Edit / Delete"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={activeAdminTab === id ? "active" : ""}
            onClick={() => setActiveAdminTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeAdminTab === "overview" && (
        <div className="admin-overview-grid">
          <Card>
            <SectionTitle icon={Trophy} title="Active Season" />
            <h3>{allSeasons.find((season) => season.status === "active")?.name ?? "No active season"}</h3>
            <p className="helper-text">Use Seasons & Leagues to create seasons, add leagues and sort league order.</p>
          </Card>
          <Card>
            <SectionTitle icon={Users} title="Teams" />
            <h3>{adminTeams.length}</h3>
            <p className="helper-text">Active teams, players and captain emails are managed in Quick Add and Edit / Delete.</p>
          </Card>
          <Card>
            <SectionTitle icon={CalendarDays} title="Fixtures" />
            <h3>{adminFixtures.length}</h3>
            <p className="helper-text">Generate full round-robin schedules or add individual fixtures.</p>
          </Card>
          <Card>
            <SectionTitle icon={ClipboardList} title="Captain Submissions" />
            <h3>{captainSubmissions.length}</h3>
            <p className="helper-text">Approve, dispute or delete score submissions from captains.</p>
          </Card>
        </div>
      )}

      {activeAdminTab === "settings" && (
        <div className="admin-grid two club-settings-grid">
          <Card>
            <SectionTitle icon={Settings} title="Club Profile" />
            <form className="admin-form club-settings-form" onSubmit={handleSaveClubSettings}>
              <label>
                Club name
                <input value={clubName} onChange={(event) => setClubName(event.target.value)} required />
              </label>
              <label>
                Short name
                <input value={clubShortName} onChange={(event) => setClubShortName(event.target.value)} placeholder="GSM" />
              </label>
              <label>
                Contact email
                <input type="email" value={clubContactEmail} onChange={(event) => setClubContactEmail(event.target.value)} />
              </label>
              <label>
                Website URL
                <input value={clubWebsiteUrl} onChange={(event) => setClubWebsiteUrl(event.target.value)} placeholder="https://..." />
              </label>
              <label>
                Instagram URL
                <input value={clubInstagramUrl} onChange={(event) => setClubInstagramUrl(event.target.value)} placeholder="https://instagram.com/..." />
              </label>
              <label>
                Facebook URL
                <input value={clubFacebookUrl} onChange={(event) => setClubFacebookUrl(event.target.value)} placeholder="https://facebook.com/..." />
              </label>
              <label className="wide-field">
                Welcome text
                <textarea value={clubWelcomeText} onChange={(event) => setClubWelcomeText(event.target.value)} />
              </label>
              <label className="wide-field">
                Footer text
                <input value={clubFooterText} onChange={(event) => setClubFooterText(event.target.value)} />
              </label>
              <button className="primary-button wide-field" type="submit">Save Club Settings</button>
            </form>
          </Card>

          <Card>
            <SectionTitle icon={Trophy} title="Branding" />
            <form className="admin-form club-settings-form" onSubmit={handleSaveClubSettings}>
              <label className="wide-field">
                Logo URL
                <input value={clubLogoUrl} onChange={(event) => setClubLogoUrl(event.target.value)} placeholder="/gsm-logo.png or uploaded URL" />
              </label>
              <label className="wide-field sponsor-upload-field">
                Upload club logo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleClubLogoUpload}
                  disabled={clubLogoUploading}
                />
                <small>Best size: 1200 × 600 px · PNG/JPG/SVG/WebP · max 1 MB</small>
              </label>
              {clubLogoUploadError && <p className="sponsor-upload-alert error-box">{clubLogoUploadError}</p>}
              {clubLogoUploadMessage && <p className="sponsor-upload-alert success-box">{clubLogoUploadMessage}</p>}
              <div className="club-brand-preview wide-field" style={{ background: clubSecondaryColor }}>
                <img src={clubLogoUrl || "/gsm-logo.png"} alt={clubName || "Club logo"} />
                <div>
                  <strong>{clubName || "Club Name"}</strong>
                  <span>{clubShortName || "Club"} League Hub</span>
                </div>
              </div>
              <label>
                Primary colour
                <input type="color" value={clubPrimaryColor} onChange={(event) => setClubPrimaryColor(event.target.value)} />
              </label>
              <label>
                Secondary colour
                <input type="color" value={clubSecondaryColor} onChange={(event) => setClubSecondaryColor(event.target.value)} />
              </label>
              <label>
                Accent colour
                <input type="color" value={clubAccentColor} onChange={(event) => setClubAccentColor(event.target.value)} />
              </label>
              <button className="primary-button wide-field" type="submit" disabled={clubLogoUploading}>
                {clubLogoUploading ? "Uploading..." : "Save Branding"}
              </button>
            </form>
            <p className="helper-text">
              This is the first multi-club foundation. GSM is the first club now; later each paying club can have its own settings, branding and public URL.
            </p>
          </Card>
        </div>
      )}

      {activeAdminTab === "setup" && (
      <div className="admin-grid two season-admin-grid">
        <Card>
          <SectionTitle icon={Trophy} title="Season Setup" />
          <form className="admin-form season-form" onSubmit={handleCreateSeason}>
            <label>
              New season name
              <input
                value={newSeasonName}
                onChange={(event) => setNewSeasonName(event.target.value)}
                placeholder="Example: Autumn 2026"
                required
              />
            </label>
            <label>
              Start date
              <input
                type="date"
                value={newSeasonStart}
                onChange={(event) => setNewSeasonStart(event.target.value)}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                value={newSeasonEnd}
                onChange={(event) => setNewSeasonEnd(event.target.value)}
              />
            </label>
            <button className="primary-button" type="submit">
              Create + Activate Season
            </button>
          </form>
          <p className="helper-text">
            This creates a fresh season with Division 1, Division 2 and Division 3 ready for teams.
          </p>
          {editingSeasonId && (
            <form className="admin-form inline-edit-form" onSubmit={handleUpdateSeason}>
              <label>
                Edit season name
                <input
                  value={editingSeasonName}
                  onChange={(event) => setEditingSeasonName(event.target.value)}
                  required
                />
              </label>
              <label>
                Start date
                <input
                  type="date"
                  value={editingSeasonStart}
                  onChange={(event) => setEditingSeasonStart(event.target.value)}
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  value={editingSeasonEnd}
                  onChange={(event) => setEditingSeasonEnd(event.target.value)}
                />
              </label>
              <div className="form-actions">
                <button className="primary-button" type="submit">Save Season</button>
                <button className="secondary-admin-button" type="button" onClick={cancelEditSeason}>Cancel</button>
              </div>
            </form>
          )}
          <div className="admin-list action-rows season-list">
            {allSeasons.map((season) => (
              <div key={season.id}>
                <span>
                  <strong>{season.name}</strong>
                  <small>
                    {season.status ?? "draft"}
                    {season.starts_on ? ` · ${season.starts_on}` : ""}
                    {season.ends_on ? ` to ${season.ends_on}` : ""}
                  </small>
                </span>
                <div className="row-actions">
                  <button
                    type="button"
                    disabled={season.status === "active" || adminLoading}
                    onClick={() => handleActivateSeason(season.id)}
                  >
                    {season.status === "active" ? "Active" : "Make Active"}
                  </button>
                  <button type="button" onClick={() => beginEditSeason(season)}>
                    <Pencil size={15} /> Edit
                  </button>
                  <button
                    type="button"
                    disabled={season.status === "active" || adminLoading}
                    onClick={() => handleArchiveSeason(season)}
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    className="danger"
                    disabled={season.status === "active" || adminLoading}
                    onClick={() => handleDeleteSeason(season)}
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={Table2} title="Division Setup" />
          <form className="admin-form season-form" onSubmit={handleAddDivision}>
            <label>
              Division name
              <input
                value={newDivisionName}
                onChange={(event) => setNewDivisionName(event.target.value)}
                placeholder="Example: Division 4"
                required
              />
            </label>
            <label>
              Sort order
              <input
                type="number"
                min="1"
                value={newDivisionSortOrder}
                onChange={(event) => setNewDivisionSortOrder(event.target.value)}
              />
            </label>
            <button className="primary-button" type="submit">
              Add Division
            </button>
          </form>
          <div className="admin-inline-actions division-sort-tools">
            <button className="secondary-admin-button" type="button" onClick={handleNormaliseDivisionOrder}>
              Clean Sort Order
            </button>
          </div>
          <p className="helper-text">
            Use Move up / Move down to control the order shown on the homepage, tables, fixtures and admin forms.
          </p>
          {editingDivisionId && (
            <form className="admin-form inline-edit-form" onSubmit={handleUpdateDivision}>
              <label>
                Edit league name
                <input
                  value={editingDivisionName}
                  onChange={(event) => setEditingDivisionName(event.target.value)}
                  required
                />
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  min="1"
                  value={editingDivisionSortOrder}
                  onChange={(event) => setEditingDivisionSortOrder(event.target.value)}
                />
              </label>
              <div className="form-actions">
                <button className="primary-button" type="submit">Save League</button>
                <button className="secondary-admin-button" type="button" onClick={cancelEditDivision}>Cancel</button>
              </div>
            </form>
          )}
          <div className="admin-list action-rows season-list">
            {orderedAdminDivisions.map((division, index) => (
              <div key={division.id}>
                <span>
                  <strong>{division.name}</strong>
                  <small>League position {index + 1} · Sort order {division.sort_order}</small>
                </span>
                <div className="row-actions">
                  <button
                    type="button"
                    disabled={index === 0 || adminLoading}
                    onClick={() => handleMoveDivision(division.id, "up")}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={index === orderedAdminDivisions.length - 1 || adminLoading}
                    onClick={() => handleMoveDivision(division.id, "down")}
                  >
                    Move down
                  </button>
                  <button type="button" onClick={() => beginEditDivision(division)}>
                    <Pencil size={15} /> Edit
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleDeleteDivision(division)}
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      )}

      {activeAdminTab === "fixtures" && (
      <Card>
        <SectionTitle icon={Swords} title="Fixture Generator" />
        <div className="fixture-mode-note">
          <strong>Choose how this league releases fixtures.</strong>
          <p>
            Use Weekly Rounds for normal league weeks. Use Monthly Fixture Pack when clubs want 2–4 fixtures released together and played in any order before one deadline.
          </p>
        </div>
        <form className="admin-form fixture-wizard" onSubmit={handleGenerateFixtures}>
          <div className="wizard-step wide-step">
            <span className="step-badge">1</span>
            <label>
              Schedule type
              <select
                value={generatorScheduleType}
                onChange={(event) => setGeneratorScheduleType(event.target.value)}
              >
                <option value="weekly">Weekly rounds</option>
                <option value="monthly">Monthly fixture pack</option>
                <option value="custom">Custom fixture pack</option>
              </select>
              <small>
                {generatorScheduleType === "weekly"
                  ? "One round per week, each following deadline moves forward by 7 days."
                  : "Several fixtures are released together and can be played in any order before the deadline."}
              </small>
            </label>
          </div>

          <div className="wizard-step">
            <span className="step-badge">2</span>
            <label>
              Choose league
              <select
                value={generatorDivisionId}
                onChange={(event) => setGeneratorDivisionId(event.target.value)}
                required
              >
                {adminDivisions.map((division) => (
                  <option key={division.id} value={division.id}>
                    {division.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="wizard-step">
            <span className="step-badge">3</span>
            <label>
              Fixture format
              <select
                value={generatorFormat}
                onChange={(event) => setGeneratorFormat(event.target.value)}
              >
                <option value="single">Round robin once</option>
                <option value="double">Double round robin</option>
              </select>
            </label>
          </div>

          <div className="wizard-step">
            <span className="step-badge">4</span>
            <label>
              {generatorScheduleType === "weekly" ? "Starting fixture week number" : "Pack number"}
              <input
                type="number"
                min="1"
                value={generatorStartWeek}
                onChange={(event) => setGeneratorStartWeek(event.target.value)}
                required
              />
              <small>
                {generatorScheduleType === "weekly"
                  ? "Example: enter 1 for a new league, or 8 if weeks 1–7 already exist."
                  : "Used internally for sorting. Example: 1 for June pack, 2 for July pack."}
              </small>
            </label>
          </div>

          {generatorScheduleType === "weekly" ? (
            <div className="wizard-step">
              <span className="step-badge">5</span>
              <label>
                First fixture deadline
                <input
                  type="date"
                  value={generatorFirstPlayBy}
                  onChange={(event) => setGeneratorFirstPlayBy(event.target.value)}
                  required
                />
                <small>Each following week automatically moves forward by 7 days.</small>
              </label>
            </div>
          ) : (
            <>
              <div className="wizard-step">
                <span className="step-badge">5</span>
                <label>
                  Pack name
                  <input
                    value={generatorPackName}
                    onChange={(event) => setGeneratorPackName(event.target.value)}
                    placeholder="Example: June Fixture Pack"
                  />
                  <small>Shown publicly above these fixtures.</small>
                </label>
              </div>

              <div className="wizard-step">
                <span className="step-badge">6</span>
                <label>
                  Available from
                  <input
                    type="date"
                    value={generatorAvailableFrom}
                    onChange={(event) => setGeneratorAvailableFrom(event.target.value)}
                  />
                  <small>Optional. Use the first day of the month/pack.</small>
                </label>
              </div>

              <div className="wizard-step">
                <span className="step-badge">7</span>
                <label>
                  Pack deadline
                  <input
                    type="date"
                    value={generatorDeadline}
                    onChange={(event) => setGeneratorDeadline(event.target.value)}
                    required
                  />
                  <small>All generated fixtures must be played by this date.</small>
                </label>
              </div>

              <div className="wizard-step">
                <span className="step-badge">8</span>
                <label>
                  Fixtures per team
                  <input
                    type="number"
                    min="1"
                    value={generatorFixturesPerTeam}
                    onChange={(event) => setGeneratorFixturesPerTeam(event.target.value)}
                    required
                  />
                  <small>Example: 3 fixtures per team to play in any order within the month.</small>
                </label>
              </div>
            </>
          )}

          <div className="wizard-step">
            <span className="step-badge">{generatorScheduleType === "weekly" ? "6" : "9"}</span>
            <label>
              Court / note
              <input
                value={generatorCourt}
                onChange={(event) => setGeneratorCourt(event.target.value)}
                placeholder="Arrange"
              />
              <small>Example: Arrange, Court 1, or Play in any order.</small>
            </label>
          </div>

          <label className="checkbox-row generator-clear-row">
            <input
              type="checkbox"
              checked={generatorClearExisting}
              onChange={(event) => setGeneratorClearExisting(event.target.checked)}
            />
            {generatorScheduleType === "weekly"
              ? "Clear existing fixtures in this generated week range first"
              : "Clear existing fixtures with this pack name first"}
          </label>

          <button className="primary-button" type="submit">
            {generatorScheduleType === "weekly" ? "Generate Weekly Fixtures" : "Generate Fixture Pack"}
          </button>
        </form>

        <div className="generator-summary">
          <div>
            <strong>{generatorTeams.length}</strong>
            <span>teams selected</span>
          </div>
          <div>
            <strong>{generatorPreviewRows.length}</strong>
            <span>fixtures to create</span>
          </div>
          <div>
            <strong>{generatorPreviewRangeLabel}</strong>
            <span>{generatorScheduleType === "weekly" ? "generated range" : "fixture group"}</span>
          </div>
          <div>
            <strong>{generatorFormat === "double" ? "Double" : "Single"}</strong>
            <span>round robin</span>
          </div>
        </div>

        <div className="generator-preview">
          <div className="generator-preview-header">
            <h3>Preview before saving</h3>
            <p>
              {generatorScheduleType === "weekly"
                ? "This is what will be created week by week when you click Generate Weekly Fixtures."
                : "This fixture pack will be released together. Teams can play these matches in any order before the pack deadline."}
            </p>
          </div>
          {generatorPreviewRows.length === 0 ? (
            <p className="empty-state">
              {generatorScheduleType === "weekly"
                ? "Choose a league with at least 2 teams and a first fixture deadline to preview fixtures."
                : "Choose a league with at least 2 teams, fixtures per team and a pack deadline to preview the fixture pack."}
            </p>
          ) : (
            <div className="admin-list action-rows preview-fixture-list">
              {generatorPreviewRows.slice(0, 24).map((row, index) => (
                <div key={`${row.week_number}-${row.home_team_id}-${row.away_team_id}-${index}`}>
                  <span>
                    <strong>
                      {generatorScheduleType === "weekly"
                        ? `Week ${row.week_number}: ${row.home_name} vs ${row.away_name}`
                        : `${row.fixture_group_name}: ${row.home_name} vs ${row.away_name}`}
                    </strong>
                    <small>
                      {generatorScheduleType === "weekly"
                        ? `Play by ${row.play_by} · ${row.court}`
                        : `Available ${row.available_from || "now"} · Deadline ${row.play_by} · Play in any order · ${row.court}`}
                    </small>
                  </span>
                </div>
              ))}
              {generatorPreviewRows.length > 24 && (
                <p className="empty-state">+ {generatorPreviewRows.length - 24} more fixtures will also be created.</p>
              )}
            </div>
          )}
        </div>
      </Card>
      )}

      {activeAdminTab === "captains" && (
      <div className="admin-grid two captain-admin-grid">
        <Card>
          <SectionTitle icon={UserRound} title="Assign Captain Login" />
          <form className="admin-form" onSubmit={handleAssignCaptain}>
            <label>
              Captain email
              <input
                type="email"
                value={captainEmail}
                onChange={(event) => setCaptainEmail(event.target.value)}
                placeholder="captain@email.com"
                required
              />
            </label>
            <label>
              Display name
              <input
                value={captainDisplayName}
                onChange={(event) => setCaptainDisplayName(event.target.value)}
                placeholder="Optional"
              />
            </label>
            <label>
              Team
              <select
                value={captainTeamId}
                onChange={(event) => setCaptainTeamId(event.target.value)}
                required
              >
                <option value="">Choose team</option>
                {adminTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} — {divisionById.get(team.division_id)?.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Save Captain
            </button>
          </form>
          <p className="helper-text">
            First create this email in Supabase Authentication, then assign it here.
          </p>
          <div className="admin-list action-rows captain-list">
            {captainUsers.length === 0 && (
              <p className="empty-state">No captains assigned yet.</p>
            )}
            {captainUsers.map((captain) => (
              <div key={captain.id}>
                <span>
                  <strong>{captain.display_name || captain.email}</strong>
                  <small>
                    {captain.email} · {teamById.get(captain.team_id)?.name ?? "Team not found"}
                  </small>
                </span>
                <div className="row-actions">
                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleDeleteCaptain(captain)}
                  >
                    <Trash2 size={15} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={ClipboardList} title="Captain Submissions" />
          <div className="admin-list action-rows submission-list">
            {captainSubmissions.length === 0 && (
              <p className="empty-state">No captain submissions yet.</p>
            )}
            {captainSubmissions.map((submission) => {
              const fixture = adminFixtures.find(
                (item) => item.id === submission.fixture_id,
              );
              const home = fixture
                ? teamById.get(fixture.home_team_id)?.name ?? "Home"
                : "Home";
              const away = fixture
                ? teamById.get(fixture.away_team_id)?.name ?? "Away"
                : "Away";
              return (
                <div key={submission.id}>
                  <span>
                    <strong>{home} vs {away}</strong>
                    <small>
                      Submitted by {submission.submitted_by_email ?? "captain"} · {submission.home_score ?? ""} - {submission.away_score ?? ""} · {submission.status.replaceAll("_", " ")}
                    </small>
                  </span>
                  <div className="row-actions">
                    <button
                      type="button"
                      onClick={() => handleApproveSubmission(submission)}
                    >
                      <CheckCircle2 size={15} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDisputeSubmission(submission)}
                    >
                      Dispute
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => handleDeleteSubmission(submission)}
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      )}

      {activeAdminTab === "cup" && (
      <div className="admin-grid two cup-admin-grid">
        <Card>
          <SectionTitle icon={Trophy} title="League Cup Qualification Rules" />
          <p className="helper-text">
            Set how many teams qualify from each league. Example: Top 3 from Premier, Top 3 from Division 2, Top 2 from Division 3. Turn a league off if it should not feed into the cup.
          </p>
          <div className="admin-list action-rows cup-rule-list">
            {adminDivisions.map((division, index) => {
              const draft = cupRuleDrafts[division.id] ?? {
                qualifierCount: String(index === 2 ? 2 : 3),
                isActive: index < 3,
              };
              return (
                <div key={division.id}>
                  <span>
                    <strong>{division.name}</strong>
                    <small>Current rule: {draft.isActive ? `Top ${draft.qualifierCount || 0} qualify` : "Not included in cup"}</small>
                  </span>
                  <div className="cup-rule-controls">
                    <label>
                      Qualifiers
                      <input
                        type="number"
                        min="0"
                        max="16"
                        value={draft.qualifierCount}
                        onChange={(event) => updateCupRuleDraft(division.id, { qualifierCount: event.target.value })}
                      />
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={(event) => updateCupRuleDraft(division.id, { isActive: event.target.checked })}
                      />
                      Include
                    </label>
                    <div className="row-actions">
                      <button type="button" onClick={() => handleSaveCupRule(division)}>
                        Save Rule
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={Medal} title="Manual Cup Qualifiers" />
          <p className="helper-text">
            Use this only when you want to choose exact teams yourself. If any manual qualifiers are added, the public Cup page will use these instead of automatic top-position rules.
          </p>
          <form className="admin-form manual-qualifier-form" onSubmit={handleAddManualQualifier}>
            <label>
              Team
              <select
                value={manualQualifierTeamId}
                onChange={(event) => setManualQualifierTeamId(event.target.value)}
                required
              >
                <option value="">Choose team</option>
                {adminTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} — {divisionById.get(team.division_id)?.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Seed position
              <input
                type="number"
                min="1"
                value={manualQualifierSeed}
                onChange={(event) => setManualQualifierSeed(event.target.value)}
                required
              />
            </label>
            <button className="primary-button" type="submit">Add Manual Qualifier</button>
            <button className="secondary-admin-button" type="button" onClick={handleClearManualQualifiers}>
              Clear Manual Qualifiers
            </button>
          </form>
          <div className="admin-list action-rows manual-qualifier-list">
            {adminManualQualifiers.length === 0 && (
              <p className="empty-state">No manual qualifiers selected. Cup is using automatic rules.</p>
            )}
            {adminManualQualifiers.map((qualifier) => {
              const team = teamById.get(qualifier.team_id);
              const division = team ? divisionById.get(team.division_id) : null;
              return (
                <div key={qualifier.id}>
                  <span>
                    <strong>Seed {qualifier.seed_position}: {team?.name ?? "Team not found"}</strong>
                    <small>{division?.name ?? "Unknown league"}</small>
                  </span>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="danger"
                      onClick={() => handleDeleteManualQualifier(qualifier)}
                    >
                      <Trash2 size={15} /> Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      )}

      {activeAdminTab === "sponsors" && (
      <Card>
        <SectionTitle icon={Trophy} title="Sponsor Slots" />
        <form className="admin-form sponsor-form" onSubmit={handleSaveSponsor}>
          <label>
            Sponsor name
            <input
              value={sponsorName}
              onChange={(event) => setSponsorName(event.target.value)}
              placeholder="Example: GSM Padel"
              required
            />
          </label>
          <label>
            Sponsor type
            <input
              value={sponsorType}
              onChange={(event) => setSponsorType(event.target.value)}
              placeholder="League Sponsor"
            />
          </label>
          <fieldset className="placement-fieldset">
            <legend>Show sponsor in</legend>
            <div className="placement-checkbox-grid">
              {getSponsorPlacementOptions(adminDivisions).map((option) => {
                const checked = splitSponsorPlacements(sponsorPlacement).includes(option.value);
                return (
                  <label key={option.value} className="checkbox-row placement-checkbox">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const current = splitSponsorPlacements(sponsorPlacement);
                        const next = event.target.checked
                          ? Array.from(new Set([...current, option.value]))
                          : current.filter((item) => item !== option.value);
                        setSponsorPlacement(next.length ? next.join(",") : "homepage");
                      }}
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <label>
            Sort order
            <input
              type="number"
              value={sponsorSortOrder}
              onChange={(event) => setSponsorSortOrder(event.target.value)}
            />
          </label>
          <label>
            Logo URL
            <input
              value={sponsorLogoUrl}
              onChange={(event) => setSponsorLogoUrl(event.target.value)}
              placeholder="Optional image URL or upload below"
            />
          </label>
          <label className="sponsor-upload-field">
            Upload logo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleSponsorLogoUpload}
              disabled={sponsorLogoUploading}
            />
            <small>Best size: 1200 × 600 px · PNG/JPG/SVG/WebP · max 1 MB</small>
          </label>
          {sponsorUploadError && (
            <p className="sponsor-upload-alert error-box">{sponsorUploadError}</p>
          )}
          {sponsorUploadMessage && (
            <p className="sponsor-upload-alert success-box">{sponsorUploadMessage}</p>
          )}
          <div className="sponsor-upload-preview">
            <SponsorLogo
              compact
              sponsor={{
                name: sponsorName || "Sponsor",
                sponsorType,
                placement: sponsorPlacement,
                logoUrl: sponsorLogoUrl,
                websiteUrl: sponsorWebsiteUrl,
              }}
            />
            <button
              type="button"
              className="secondary-admin-button"
              onClick={() => setSponsorLogoUrl("")}
              disabled={!sponsorLogoUrl || sponsorLogoUploading}
            >
              Remove Logo
            </button>
          </div>
          <label>
            Website URL
            <input
              value={sponsorWebsiteUrl}
              onChange={(event) => setSponsorWebsiteUrl(event.target.value)}
              placeholder="Optional website"
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={sponsorIsActive}
              onChange={(event) => setSponsorIsActive(event.target.checked)}
            />
            Active sponsor
          </label>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={sponsorLogoUploading}>
              {sponsorLogoUploading ? "Uploading Logo..." : editingSponsorId ? "Update Sponsor" : "Add Sponsor"}
            </button>
            {editingSponsorId && (
              <button type="button" className="secondary-admin-button" onClick={resetSponsorForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>
        <div className="admin-list action-rows sponsor-admin-list">
          {adminSponsors.length === 0 && <p className="empty-state">No sponsors added yet.</p>}
          {adminSponsors.map((sponsor) => (
            <div key={sponsor.id}>
              <span className="sponsor-admin-info">
                <SponsorLogo
                  compact
                  sponsor={{
                    name: sponsor.name,
                    sponsorType: sponsor.sponsor_type,
                    placement: sponsor.placement,
                    logoUrl: sponsor.logo_url,
                    websiteUrl: sponsor.website_url,
                  }}
                />
                <span>
                  <strong>{sponsor.name}</strong>
                  <small>
                    {sponsor.sponsor_type ?? "Sponsor"} · {formatSponsorPlacements(sponsor.placement)} · order {sponsor.sort_order ?? 10}
                    {sponsor.website_url ? " · linked" : " · no website"}
                    {sponsor.logo_url ? " · logo added" : " · placeholder showing"}
                    {sponsor.is_active === false ? " · inactive" : ""}
                  </small>
                </span>
              </span>
              <div className="row-actions">
                <button type="button" onClick={() => beginEditSponsor(sponsor)}>
                  <Pencil size={15} /> Edit
                </button>
                <button type="button" onClick={() => handleToggleSponsorActive(sponsor)}>
                  {sponsor.is_active === false ? "Activate" : "Hide"}
                </button>
                <button type="button" className="danger" onClick={() => handleDeleteSponsor(sponsor)}>
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      )}

      {activeAdminTab === "quick" && (
      <div className="admin-grid three">
        <Card>
          <SectionTitle icon={Users} title="Add Team" />
          <form className="admin-form" onSubmit={handleAddTeam}>
            <label>
              Division
              <select
                value={newTeamDivisionId}
                onChange={(event) => setNewTeamDivisionId(event.target.value)}
              >
                {adminDivisions.map((division) => (
                  <option key={division.id} value={division.id}>
                    {division.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Team name
              <input
                value={newTeamName}
                onChange={(event) => setNewTeamName(event.target.value)}
                placeholder="Team name"
                required
              />
            </label>
            <label>
              Player 1
              <input
                value={newTeamPlayerOne}
                onChange={(event) => setNewTeamPlayerOne(event.target.value)}
                placeholder="Player one name"
              />
            </label>
            <label>
              Player 2
              <input
                value={newTeamPlayerTwo}
                onChange={(event) => setNewTeamPlayerTwo(event.target.value)}
                placeholder="Player two name"
              />
            </label>
            <label>
              Captain email
              <input
                type="email"
                value={newTeamCaptainEmail}
                onChange={(event) => setNewTeamCaptainEmail(event.target.value)}
                placeholder="captain@email.com"
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={newTeamIsActive}
                onChange={(event) => setNewTeamIsActive(event.target.checked)}
              />
              Active team
            </label>
            <button className="primary-button" type="submit">
              Add Team
            </button>
          </form>
        </Card>

        <Card>
          <SectionTitle icon={CalendarDays} title="Add Fixture" />
          <form className="admin-form" onSubmit={handleAddFixture}>
            <label>
              Division
              <select
                value={fixtureDivisionId}
                onChange={(event) => {
                  setFixtureDivisionId(event.target.value);
                  setFixtureHomeTeamId("");
                  setFixtureAwayTeamId("");
                }}
              >
                {adminDivisions.map((division) => (
                  <option key={division.id} value={division.id}>
                    {division.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Week
              <input
                type="number"
                min="1"
                value={fixtureWeek}
                onChange={(event) => setFixtureWeek(event.target.value)}
                required
              />
            </label>
            <label>
              Play by
              <input
                type="date"
                value={fixturePlayBy}
                onChange={(event) => setFixturePlayBy(event.target.value)}
                required
              />
            </label>
            <label>
              Home team
              <select
                value={fixtureHomeTeamId}
                onChange={(event) => setFixtureHomeTeamId(event.target.value)}
                required
              >
                <option value="">Choose home</option>
                {teamsForFixtureDivision.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Away team
              <select
                value={fixtureAwayTeamId}
                onChange={(event) => setFixtureAwayTeamId(event.target.value)}
                required
              >
                <option value="">Choose away</option>
                {teamsForFixtureDivision.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Court
              <input
                value={fixtureCourt}
                onChange={(event) => setFixtureCourt(event.target.value)}
              />
            </label>
            <button className="primary-button" type="submit">
              Add Fixture
            </button>
          </form>
        </Card>

        <Card>
          <SectionTitle icon={ClipboardList} title="Submit Result" />
          <form className="admin-form" onSubmit={handleSubmitResult}>
            <label>
              Fixture
              <select
                value={resultFixtureId}
                onChange={(event) => setResultFixtureId(event.target.value)}
                required
              >
                <option value="">Choose fixture</option>
                {adminFixtures.map((fixture) => (
                  <option key={fixture.id} value={fixture.id}>
                    W{fixture.week_number}:{" "}
                    {teamById.get(fixture.home_team_id)?.name ?? "Home"} vs{" "}
                    {teamById.get(fixture.away_team_id)?.name ?? "Away"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Result type
              <select
                value={resultType}
                onChange={(event) =>
                  setResultType(event.target.value as ResultType)
                }
              >
                <option value="home_win">Home win</option>
                <option value="away_win">Away win</option>
                <option value="away_forfeit">Away forfeited - home wins</option>
                <option value="home_forfeit">Home forfeited - away wins</option>
                <option value="double_forfeit">Double forfeit</option>
              </select>
            </label>
            <label>
              Home score
              <input
                value={homeScore}
                onChange={(event) => setHomeScore(event.target.value)}
                placeholder="Example: 6,6"
              />
            </label>
            <label>
              Away score
              <input
                value={awayScore}
                onChange={(event) => setAwayScore(event.target.value)}
                placeholder="Example: 3,4"
              />
            </label>
            <label>
              Notes
              <textarea
                value={resultNotes}
                onChange={(event) => setResultNotes(event.target.value)}
                placeholder="Optional notes"
              />
            </label>
            <button className="primary-button" type="submit">
              Save Result
            </button>
          </form>
          {selectedResultFixture && (
            <p className="helper-text">
              Selected:{" "}
              {divisionById.get(selectedResultFixture.division_id)?.name} ·{" "}
              {teamById.get(selectedResultFixture.home_team_id)?.name} vs{" "}
              {teamById.get(selectedResultFixture.away_team_id)?.name}
              {resultByFixtureId.has(selectedResultFixture.id)
                ? " · Existing result will be updated"
                : ""}
            </p>
          )}
        </Card>
      </div>
      )}

      {activeAdminTab === "demo" && (
        <div className="admin-grid two demo-tools-grid">
          <Card>
            <SectionTitle icon={ClipboardList} title="Demo Data Manager" />
            <div className="admin-form">
              <p className="helper-text">
                Use this to quickly turn the active club/season into a complete customer demo with 8 teams per league,
                demo players, captain emails, fixtures, confirmed results, standings, sponsors and League Cup rules.
              </p>
              <button
                className="primary-button wide-field"
                type="button"
                onClick={handleLoadFullDemo}
                disabled={adminLoading}
              >
                Load Full Demo Club
              </button>
              <button
                className="danger-button wide-field"
                type="button"
                onClick={handleResetDemoData}
                disabled={adminLoading}
              >
                Reset Demo Data
              </button>
            </div>
          </Card>

          <Card>
            <SectionTitle icon={ShieldCheck} title="What gets loaded" />
            <div className="demo-checklist">
              <div><strong>Teams:</strong> 8 demo teams in every active league/division</div>
              <div><strong>Players:</strong> two player names and a captain email per team</div>
              <div><strong>Fixtures:</strong> three weekly rounds with Week 1 and Week 2 completed</div>
              <div><strong>Results:</strong> confirmed demo scores and live-looking standings</div>
              <div><strong>Sponsors:</strong> sample sponsor slots for homepage, leagues and cup</div>
              <div><strong>League Cup:</strong> automatic qualifier rules using top teams from each league</div>
            </div>
            <p className="warning-box small-warning">
              Demo tools are for sales/testing only. Do not run this on a real live season unless you are happy to replace demo/test data.
            </p>
          </Card>
        </div>
      )}

      {activeAdminTab === "manage" && (
      <div className="admin-grid three manage-grid">
        <Card>
          <SectionTitle icon={Table2} title="Manage Teams" />
          {editingTeamId && (
            <form className="admin-form edit-box" onSubmit={handleUpdateTeam}>
              <label>
                Team name
                <input
                  value={editingTeamName}
                  onChange={(event) => setEditingTeamName(event.target.value)}
                  required
                />
              </label>
              <label>
                Division
                <select
                  value={editingTeamDivisionId}
                  onChange={(event) =>
                    setEditingTeamDivisionId(event.target.value)
                  }
                >
                  {adminDivisions.map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Player 1
                <input
                  value={editingTeamPlayerOne}
                  onChange={(event) => setEditingTeamPlayerOne(event.target.value)}
                  placeholder="Player one name"
                />
              </label>
              <label>
                Player 2
                <input
                  value={editingTeamPlayerTwo}
                  onChange={(event) => setEditingTeamPlayerTwo(event.target.value)}
                  placeholder="Player two name"
                />
              </label>
              <label>
                Captain email
                <input
                  type="email"
                  value={editingTeamCaptainEmail}
                  onChange={(event) => setEditingTeamCaptainEmail(event.target.value)}
                  placeholder="captain@email.com"
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={editingTeamIsActive}
                  onChange={(event) => setEditingTeamIsActive(event.target.checked)}
                />
                Active team
              </label>
              <div className="admin-inline-actions">
                <button className="primary-button" type="submit">
                  Save Team
                </button>
                <button
                  className="secondary-admin-button"
                  type="button"
                  onClick={cancelEditTeam}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          <div className="admin-list action-rows">
            {adminTeams.map((team) => (
              <div key={team.id}>
                <span>
                  <strong>{team.name}</strong>
                  <small>
                    {divisionById.get(team.division_id)?.name}
                    {team.player_one_name || team.player_two_name
                      ? ` · ${[team.player_one_name, team.player_two_name].filter(Boolean).join(" / ")}`
                      : ""}
                    {team.captain_email ? ` · Captain: ${team.captain_email}` : ""}
                    {team.is_active === false ? " · Inactive" : ""}
                  </small>
                </span>
                <div className="row-actions">
                  <button type="button" onClick={() => beginEditTeam(team)}>
                    <Pencil size={15} /> Edit
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleDeleteTeam(team)}
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={CalendarDays} title="Manage Fixtures" />
          {editingFixtureId && (
            <form
              className="admin-form edit-box"
              onSubmit={handleUpdateFixture}
            >
              <label>
                Division
                <select
                  value={editingFixtureDivisionId}
                  onChange={(event) => {
                    setEditingFixtureDivisionId(event.target.value);
                    setEditingFixtureHomeTeamId("");
                    setEditingFixtureAwayTeamId("");
                  }}
                >
                  {adminDivisions.map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Week
                <input
                  type="number"
                  min="1"
                  value={editingFixtureWeek}
                  onChange={(event) =>
                    setEditingFixtureWeek(event.target.value)
                  }
                  required
                />
              </label>
              <label>
                Play by
                <input
                  type="date"
                  value={editingFixturePlayBy}
                  onChange={(event) =>
                    setEditingFixturePlayBy(event.target.value)
                  }
                  required
                />
              </label>
              <label>
                Home team
                <select
                  value={editingFixtureHomeTeamId}
                  onChange={(event) =>
                    setEditingFixtureHomeTeamId(event.target.value)
                  }
                  required
                >
                  <option value="">Choose home</option>
                  {editingFixtureTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Away team
                <select
                  value={editingFixtureAwayTeamId}
                  onChange={(event) =>
                    setEditingFixtureAwayTeamId(event.target.value)
                  }
                  required
                >
                  <option value="">Choose away</option>
                  {editingFixtureTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={editingFixtureStatus}
                  onChange={(event) =>
                    setEditingFixtureStatus(event.target.value)
                  }
                >
                  <option value="open">Open</option>
                  <option value="submitted">Submitted</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="disputed">Disputed</option>
                  <option value="forfeit">Forfeit</option>
                  <option value="double_forfeit">Double Forfeit</option>
                </select>
              </label>
              <label>
                Court
                <input
                  value={editingFixtureCourt}
                  onChange={(event) =>
                    setEditingFixtureCourt(event.target.value)
                  }
                />
              </label>
              <div className="admin-inline-actions">
                <button className="primary-button" type="submit">
                  Save Fixture
                </button>
                <button
                  className="secondary-admin-button"
                  type="button"
                  onClick={cancelEditFixture}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          <div className="admin-list action-rows">
            {adminFixtures.map((fixture) => (
              <div key={fixture.id}>
                <span>
                  <strong>
                    W{fixture.week_number}:{" "}
                    {teamById.get(fixture.home_team_id)?.name ?? "Home"} vs{" "}
                    {teamById.get(fixture.away_team_id)?.name ?? "Away"}
                  </strong>
                  <small>
                    {divisionById.get(fixture.division_id)?.name} ·{" "}
                    {fixture.play_by} · {fixture.status}
                  </small>
                </span>
                <div className="row-actions">
                  <button
                    type="button"
                    onClick={() => beginEditFixture(fixture)}
                  >
                    <Pencil size={15} /> Edit
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleDeleteFixture(fixture)}
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={ClipboardList} title="Manage Results" />
          <div className="admin-list action-rows">
            {adminResults.length === 0 && (
              <p className="empty-state">No saved results yet.</p>
            )}
            {adminResults.map((result) => {
              const fixture = adminFixtures.find(
                (item) => item.id === result.fixture_id,
              );
              return (
                <div key={result.id}>
                  <span>
                    <strong>
                      {fixture
                        ? `${teamById.get(fixture.home_team_id)?.name ?? "Home"} vs ${teamById.get(fixture.away_team_id)?.name ?? "Away"}`
                        : "Result"}
                    </strong>
                    <small>
                      {result.home_score ?? ""} - {result.away_score ?? ""} ·{" "}
                      {result.status}
                    </small>
                  </span>
                  <div className="row-actions">
                    <button
                      type="button"
                      onClick={() => loadResultIntoForm(result)}
                    >
                      <Pencil size={15} /> Edit
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => handleDeleteResult(result)}
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      )}
    </PageShell>
  );
}

function CaptainPage({ onDataChanged }: { onDataChanged: () => void }) {
  const supabase = createClient();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [captainLoading, setCaptainLoading] = useState(false);
  const [captainRecord, setCaptainRecord] = useState<CaptainUserRecord | null>(null);
  const [captainDivisions, setCaptainDivisions] = useState<AdminDivision[]>([]);
  const [captainTeams, setCaptainTeams] = useState<AdminTeam[]>([]);
  const [captainFixtures, setCaptainFixtures] = useState<AdminFixture[]>([]);
  const [captainSubmissions, setCaptainSubmissions] = useState<CaptainSubmissionRecord[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fixtureId, setFixtureId] = useState("");
  const [resultType, setResultType] = useState<ResultType>("home_win");
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function showSuccess(text: string) {
    setMessage(text);
    setErrorMessage(null);
  }

  function showError(text: string) {
    setErrorMessage(text);
    setMessage(null);
  }

  async function loadCaptainData(authEmail?: string | null) {
    const lookupEmail = authEmail?.toLowerCase();
    if (!lookupEmail) return;

    setCaptainLoading(true);
    try {
      const { data: captainRows, error: captainError } = await supabase
        .from("captain_users")
        .select("id, email, team_id, display_name, created_at")
        .eq("email", lookupEmail)
        .limit(1)
        .returns<CaptainUserRecord[]>();

      if (captainError) throw captainError;
      const captain = captainRows?.[0] ?? null;
      setCaptainRecord(captain);
      if (!captain) {
        setCaptainFixtures([]);
        setCaptainSubmissions([]);
        return;
      }

      const { data: seasonRows, error: seasonError } = await supabase
        .from("seasons")
        .select("id, name, status, starts_on, ends_on")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<SeasonRecord[]>();
      if (seasonError) throw seasonError;
      const activeSeason = seasonRows?.[0];
      if (!activeSeason) throw new Error("No active season found.");

      const { data: divisionRows, error: divisionError } = await supabase
        .from("divisions")
        .select("id, name, sort_order")
        .eq("season_id", activeSeason.id)
        .order("sort_order", { ascending: true })
        .returns<AdminDivision[]>();
      if (divisionError) throw divisionError;
      const divisions = divisionRows ?? [];
      const divisionIds = divisions.map((division) => division.id);

      const [teamsResponse, fixturesResponse] = await Promise.all([
        supabase
          .from("teams")
          .select("id, name, division_id, player_one_name, player_two_name, captain_email, is_active")
          .in("division_id", divisionIds)
          .order("name", { ascending: true })
          .returns<AdminTeam[]>(),
        supabase
          .from("fixtures")
          .select("id, week_number, play_by, court, status, division_id, home_team_id, away_team_id")
          .eq("season_id", activeSeason.id)
          .or(`home_team_id.eq.${captain.team_id},away_team_id.eq.${captain.team_id}`)
          .order("week_number", { ascending: false })
          .returns<AdminFixture[]>(),
      ]);

      if (teamsResponse.error) throw teamsResponse.error;
      if (fixturesResponse.error) throw fixturesResponse.error;

      const fixtures = fixturesResponse.data ?? [];
      const fixtureIds = fixtures.map((fixture) => fixture.id);
      let submissions: CaptainSubmissionRecord[] = [];
      if (fixtureIds.length) {
        const { data: submissionRows, error: submissionError } = await supabase
          .from("result_submissions")
          .select("id, fixture_id, submitting_team_id, submitted_by_email, home_score, away_score, winner_team_id, notes, status, opponent_confirmed_by_email, created_at")
          .in("fixture_id", fixtureIds)
          .order("created_at", { ascending: false })
          .returns<CaptainSubmissionRecord[]>();
        if (submissionError) throw submissionError;
        submissions = submissionRows ?? [];
      }

      setCaptainDivisions(divisions);
      setCaptainTeams(teamsResponse.data ?? []);
      setCaptainFixtures(fixtures);
      setCaptainSubmissions(submissions);
      if (!fixtureId && fixtures[0]) setFixtureId(fixtures[0].id);
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not load captain data.",
      );
    } finally {
      setCaptainLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadAuth() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const authUser = data.user
        ? { id: data.user.id, email: data.user.email ?? undefined }
        : null;
      setUser(authUser);
      setAuthLoading(false);
      if (authUser) await loadCaptainData(authUser.email);
    }

    loadAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const authUser = session?.user
          ? { id: session.user.id, email: session.user.email ?? undefined }
          : null;
        setUser(authUser);
        setCaptainRecord(null);
        if (authUser) await loadCaptainData(authUser.email);
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const teamById = new Map(captainTeams.map((team) => [team.id, team]));
  const divisionById = new Map(captainDivisions.map((division) => [division.id, division]));
  const selectedFixture = captainFixtures.find((fixture) => fixture.id === fixtureId);
  const myTeam = captainRecord ? teamById.get(captainRecord.team_id) : null;

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showSuccess("Logged in successfully.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setCaptainRecord(null);
    setCaptainFixtures([]);
    setCaptainSubmissions([]);
    showSuccess("Logged out.");
  }

  async function handleSubmitCaptainResult(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captainRecord || !selectedFixture) {
      showError("Choose a fixture first.");
      return;
    }

    setCaptainLoading(true);
    try {
      const homeWins = resultType === "home_win" || resultType === "away_forfeit";
      const awayWins = resultType === "away_win" || resultType === "home_forfeit";
      const doubleForfeit = resultType === "double_forfeit";
      const winnerTeamId = homeWins
        ? selectedFixture.home_team_id
        : awayWins
          ? selectedFixture.away_team_id
          : null;

      if (!doubleForfeit && !resultType.includes("forfeit") && (!homeScore.trim() || !awayScore.trim())) {
        throw new Error("Add both scores before submitting.");
      }

      const payload = {
        fixture_id: selectedFixture.id,
        submitting_team_id: captainRecord.team_id,
        submitted_by_email: user?.email?.toLowerCase() ?? null,
        home_score: doubleForfeit
          ? "Double forfeit"
          : resultType === "home_forfeit"
            ? "Forfeit"
            : homeScore.trim(),
        away_score: doubleForfeit
          ? "Double forfeit"
          : resultType === "away_forfeit"
            ? "Forfeit"
            : awayScore.trim(),
        winner_team_id: winnerTeamId,
        notes: notes.trim() || null,
        status: "pending_opponent",
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("result_submissions").upsert(payload, {
        onConflict: "fixture_id,submitting_team_id",
      });
      if (error) throw error;

      setHomeScore("");
      setAwayScore("");
      setNotes("");
      showSuccess("Result submitted. Admin can now approve it.");
      await loadCaptainData(user?.email);
      onDataChanged();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not submit result.",
      );
    } finally {
      setCaptainLoading(false);
    }
  }

  async function handleConfirmOpponentSubmission(submission: CaptainSubmissionRecord, disputed = false) {
    if (!captainRecord) return;
    const fixture = captainFixtures.find((item) => item.id === submission.fixture_id);
    if (!fixture || submission.submitting_team_id === captainRecord.team_id) return;

    setCaptainLoading(true);
    try {
      const { error } = await supabase
        .from("result_submissions")
        .update({
          status: disputed ? "disputed" : "confirmed_by_opponent",
          opponent_confirmed_by_email: user?.email?.toLowerCase() ?? null,
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", submission.id);
      if (error) throw error;
      showSuccess(disputed ? "Submission disputed." : "Submission confirmed. Admin can now approve it.");
      await loadCaptainData(user?.email);
      onDataChanged();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not update submission.",
      );
    } finally {
      setCaptainLoading(false);
    }
  }

  if (authLoading) {
    return (
      <PageShell icon={UserRound} title="Captain Login" subtitle="Checking session...">
        <Card><p className="empty-state">Loading captain area...</p></Card>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell icon={UserRound} title="Captain Login" subtitle="Captains can submit match results for their team.">
        <div className="admin-grid">
          <Card>
            <SectionTitle icon={UserRound} title="Captain Sign In" />
            <form className="admin-form" onSubmit={handleLogin}>
              <label>
                Email
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="captain@email.com" required />
              </label>
              <label>
                Password
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" required />
              </label>
              <button className="primary-button" type="submit">Login</button>
            </form>
            {message && <p className="success-box">{message}</p>}
            {errorMessage && <p className="error-box">{errorMessage}</p>}
          </Card>
          <Card dark>
            <Trophy size={52} />
            <h2>Captain score submissions</h2>
            <p>Submit your team score, track pending submissions and confirm opponent submissions.</p>
          </Card>
        </div>
      </PageShell>
    );
  }

  if (!captainRecord) {
    return (
      <PageShell icon={UserRound} title="Captain Access Required" subtitle="This account is logged in but not assigned to a team.">
        <Card>
          <p className="error-box">{errorMessage ?? "Your email is not assigned as a captain yet."}</p>
          <p className="empty-state">Logged in as {user.email}. Ask an admin to assign this email to a team.</p>
          <button className="secondary-admin-button" onClick={handleLogout}>Logout</button>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell icon={UserRound} title="Captain Dashboard" subtitle="Submit results and manage your team fixtures.">
      <div className="admin-topbar">
        <div>
          <strong>{captainRecord.display_name || user.email}</strong>
          <span>Team: {myTeam?.name ?? "Team not found"}</span>
        </div>
        <div className="admin-topbar-actions">
          <button onClick={() => loadCaptainData(user.email)}>Refresh</button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>
      {message && <p className="success-box">{message}</p>}
      {errorMessage && <p className="error-box">{errorMessage}</p>}
      {captainLoading && <p className="info-box">Working...</p>}

      <div className="admin-grid two">
        <Card>
          <SectionTitle icon={ClipboardList} title="Submit Result" />
          <form className="admin-form" onSubmit={handleSubmitCaptainResult}>
            <label>
              Fixture
              <select value={fixtureId} onChange={(event) => setFixtureId(event.target.value)} required>
                <option value="">Choose fixture</option>
                {captainFixtures.map((fixture) => (
                  <option key={fixture.id} value={fixture.id}>
                    W{fixture.week_number}: {teamById.get(fixture.home_team_id)?.name ?? "Home"} vs {teamById.get(fixture.away_team_id)?.name ?? "Away"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Result type
              <select value={resultType} onChange={(event) => setResultType(event.target.value as ResultType)}>
                <option value="home_win">Home win</option>
                <option value="away_win">Away win</option>
                <option value="away_forfeit">Away forfeited - home wins</option>
                <option value="home_forfeit">Home forfeited - away wins</option>
                <option value="double_forfeit">Double forfeit</option>
              </select>
            </label>
            <label>
              Home score
              <input value={homeScore} onChange={(event) => setHomeScore(event.target.value)} placeholder="Example: 6,6" />
            </label>
            <label>
              Away score
              <input value={awayScore} onChange={(event) => setAwayScore(event.target.value)} placeholder="Example: 3,4" />
            </label>
            <label>
              Notes
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes" />
            </label>
            <button className="primary-button" type="submit">Submit Result</button>
          </form>
          {selectedFixture && (
            <p className="helper-text">
              Selected: {divisionById.get(selectedFixture.division_id)?.name} · {teamById.get(selectedFixture.home_team_id)?.name} vs {teamById.get(selectedFixture.away_team_id)?.name}
            </p>
          )}
        </Card>

        <Card>
          <SectionTitle icon={CalendarDays} title="My Fixtures" />
          <div className="admin-list action-rows">
            {captainFixtures.length === 0 && <p className="empty-state">No fixtures assigned to your team yet.</p>}
            {captainFixtures.map((fixture) => (
              <div key={fixture.id}>
                <span>
                  <strong>W{fixture.week_number}: {teamById.get(fixture.home_team_id)?.name ?? "Home"} vs {teamById.get(fixture.away_team_id)?.name ?? "Away"}</strong>
                  <small>{divisionById.get(fixture.division_id)?.name} · play by {fixture.play_by} · {fixture.status}</small>
                </span>
                <div className="row-actions">
                  <button type="button" onClick={() => setFixtureId(fixture.id)}>Submit</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="admin-grid two manage-grid">
        <Card>
          <SectionTitle icon={ClipboardList} title="My Submissions" />
          <div className="admin-list action-rows">
            {captainSubmissions.filter((item) => item.submitting_team_id === captainRecord.team_id).length === 0 && (
              <p className="empty-state">You have not submitted any results yet.</p>
            )}
            {captainSubmissions.filter((item) => item.submitting_team_id === captainRecord.team_id).map((submission) => {
              const fixture = captainFixtures.find((item) => item.id === submission.fixture_id);
              return (
                <div key={submission.id}>
                  <span>
                    <strong>{fixture ? `${teamById.get(fixture.home_team_id)?.name ?? "Home"} vs ${teamById.get(fixture.away_team_id)?.name ?? "Away"}` : "Fixture"}</strong>
                    <small>{submission.home_score ?? ""} - {submission.away_score ?? ""} · {submission.status.replaceAll("_", " ")}</small>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={CheckCircle2} title="Opponent Submissions" />
          <div className="admin-list action-rows">
            {captainSubmissions.filter((item) => item.submitting_team_id !== captainRecord.team_id && item.status === "pending_opponent").length === 0 && (
              <p className="empty-state">No opponent submissions awaiting your confirmation.</p>
            )}
            {captainSubmissions.filter((item) => item.submitting_team_id !== captainRecord.team_id && item.status === "pending_opponent").map((submission) => {
              const fixture = captainFixtures.find((item) => item.id === submission.fixture_id);
              return (
                <div key={submission.id}>
                  <span>
                    <strong>{fixture ? `${teamById.get(fixture.home_team_id)?.name ?? "Home"} vs ${teamById.get(fixture.away_team_id)?.name ?? "Away"}` : "Fixture"}</strong>
                    <small>{submission.home_score ?? ""} - {submission.away_score ?? ""} · submitted by {submission.submitted_by_email}</small>
                  </span>
                  <div className="row-actions">
                    <button type="button" onClick={() => handleConfirmOpponentSubmission(submission)}>
                      <CheckCircle2 size={15} /> Confirm
                    </button>
                    <button type="button" className="danger" onClick={() => handleConfirmOpponentSubmission(submission, true)}>
                      Dispute
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

function SponsorLogo({ sponsor, compact = false }: { sponsor: Sponsor; compact?: boolean }) {
  return (
    <div className={`sponsor-logo-frame${compact ? " compact" : ""}${sponsor.logoUrl ? " has-logo" : " is-placeholder"}`}>
      {sponsor.logoUrl ? (
        <img src={sponsor.logoUrl} alt={`${sponsor.name} logo`} />
      ) : (
        <div className="sponsor-placeholder">
          <span>Your Logo Here</span>
          <em>{sponsor.name}</em>
        </div>
      )}
    </div>
  );
}

function PageShell({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Home;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="page-wrap">
      <section className="page-hero">
        <Icon />
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </section>
      {children}
    </main>
  );
}

function Sponsors({ sponsors, title = "Our Sponsors" }: { sponsors: Sponsor[]; title?: string }) {
  return (
    <section className="sponsors">
      <h2>{title}</h2>
      <div>
        {sponsors.map((sponsor) => (
          <a
            key={`${sponsor.name}-${sponsor.sponsorType ?? "sponsor"}`}
            href={sponsor.websiteUrl || undefined}
            target={sponsor.websiteUrl ? "_blank" : undefined}
            rel={sponsor.websiteUrl ? "noreferrer" : undefined}
          >
            <SponsorLogo sponsor={sponsor} />
            <small>{sponsor.sponsorType ?? sponsor.placement ?? "Sponsor"}</small>
          </a>
        ))}
      </div>
    </section>
  );
}

function Footer({ setActive, club }: { setActive: (page: PageId) => void; club: ClubSettings }) {
  return (
    <footer>
      <div className="footer-grid">
        <div>
          <img src={club.logoUrl} alt={club.name} />
          <p>{club.footerText}</p>
        </div>
        <div>
          <h4>Quick Links</h4>
          {nav.slice(1, 5).map((item) => (
            <button key={item.id} onClick={() => setActive(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <div>
          <h4>Contact</h4>
          <p>
            {club.contactEmail}
            <br />
            {club.name}
          </p>
        </div>
        <div>
          <h4>Player Updates</h4>
          <div className="email-box">
            <input placeholder="Email address" />
            <button>Join</button>
          </div>
        </div>
      </div>
    </footer>
  );
}

function MobileNav({
  active,
  setActive,
}: {
  active: PageId;
  setActive: (page: PageId) => void;
}) {
  const items = nav.filter((item) =>
    ["home", "tables", "fixtures", "teams", "captain", "admin"].includes(item.id),
  );
  return (
    <nav className="mobile-nav">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            className={cx(active === item.id && "active")}
            onClick={() => setActive(item.id)}
          >
            <Icon size={21} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
