"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  Loader2,
  LogIn,
  Palette,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

type UserState = {
  email: string | null;
  isAdmin: boolean;
  loading: boolean;
};

type LeagueDraft = {
  name: string;
  teamsPerLeague: number;
};

type CreatedSummary = {
  clubName: string;
  clubSlug: string;
  seasonName: string;
  leaguesCreated: string[];
};

const DEFAULT_LEAGUES: LeagueDraft[] = [
  { name: "Premier League", teamsPerLeague: 8 },
  { name: "Division 2", teamsPerLeague: 8 },
  { name: "Division 3", teamsPerLeague: 8 },
];

const RULE_PRESETS = [
  { value: "standard", label: "Standard Padel League Rules" },
  { value: "monthly_pack", label: "Monthly Fixture Pack Rules" },
  { value: "fast4", label: "Fast4 Rules" },
  { value: "box_league", label: "Box League Rules" },
  { value: "custom", label: "Custom Rules" },
];

const DEFAULT_RULE_TEXT = {
  fixtureRules:
    "Teams arrange their own fixture time. Matches should be played before the listed deadline unless agreed by the organiser.",
  deadlineRules:
    "Results should be submitted before the next fixture release or before the fixture pack deadline.",
  forfeitRules:
    "If one team fails to respond, arrange or attend, the organiser may award a forfeit win. If both teams fail to arrange, both teams may receive 0 points.",
  resultSubmissionRules:
    "One captain submits the score. The opposing captain or organiser can confirm, dispute or correct the result.",
  captainConfirmationRules:
    "Captains are responsible for arranging fixtures, submitting results and raising disputes quickly.",
  leagueCupRules:
    "Cup qualification can be automatic based on league position or manually selected by the organiser.",
  customRules:
    "",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
    />
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export default function RalloraOnboardingPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userState, setUserState] = useState<UserState>({ email: null, isAdmin: false, loading: true });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [step, setStep] = useState(1);
  const [clubName, setClubName] = useState("New Padel Club");
  const [shortName, setShortName] = useState("NPC");
  const [slug, setSlug] = useState("new-padel-club");
  const [contactEmail, setContactEmail] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2458ff");
  const [secondaryColor, setSecondaryColor] = useState("#0f172a");
  const [accentColor, setAccentColor] = useState("#2458ff");
  const [welcomeTitle, setWelcomeTitle] = useState("Welcome to your league hub");
  const [welcomeText, setWelcomeText] = useState("Manage fixtures, tables, results, sponsors and club competitions in one mobile-first hub.");
  const [footerText, setFooterText] = useState("Powered by Rallora — a Protego Solutions Ltd product.");
  const [seasonName, setSeasonName] = useState("Opening Season");
  const [seasonStart, setSeasonStart] = useState(new Date().toISOString().slice(0, 10));
  const [seasonEnd, setSeasonEnd] = useState("");
  const [scheduleStyle, setScheduleStyle] = useState("weekly");
  const [fixturesPerPack, setFixturesPerPack] = useState(3);
  const [winPoints, setWinPoints] = useState(3);
  const [drawPoints, setDrawPoints] = useState(1);
  const [lossPoints, setLossPoints] = useState(0);
  const [forfeitWinPoints, setForfeitWinPoints] = useState(3);
  const [forfeitLossPoints, setForfeitLossPoints] = useState(0);
  const [doubleForfeitPoints, setDoubleForfeitPoints] = useState(0);
  const [standingsTiebreaker, setStandingsTiebreaker] = useState("Points, wins, score difference, score for, head-to-head, alphabetical");
  const [rulePreset, setRulePreset] = useState("standard");
  const [scoreFormat, setScoreFormat] = useState("Best of 3 sets");
  const [fixtureRules, setFixtureRules] = useState(DEFAULT_RULE_TEXT.fixtureRules);
  const [deadlineRules, setDeadlineRules] = useState(DEFAULT_RULE_TEXT.deadlineRules);
  const [forfeitRules, setForfeitRules] = useState(DEFAULT_RULE_TEXT.forfeitRules);
  const [resultSubmissionRules, setResultSubmissionRules] = useState(DEFAULT_RULE_TEXT.resultSubmissionRules);
  const [captainConfirmationRules, setCaptainConfirmationRules] = useState(DEFAULT_RULE_TEXT.captainConfirmationRules);
  const [leagueCupRules, setLeagueCupRules] = useState(DEFAULT_RULE_TEXT.leagueCupRules);
  const [customRules, setCustomRules] = useState(DEFAULT_RULE_TEXT.customRules);
  const [leagues, setLeagues] = useState<LeagueDraft[]>(DEFAULT_LEAGUES);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdSummary, setCreatedSummary] = useState<CreatedSummary | null>(null);
  const [createDemoSetup, setCreateDemoSetup] = useState(true);

  useEffect(() => {
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkSession() {
    setUserState((prev) => ({ ...prev, loading: true }));
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData.user?.email ?? null;

    if (!userEmail) {
      setUserState({ email: null, isAdmin: false, loading: false });
      return;
    }

    const { data: adminRows, error } = await supabase
      .from("admin_users")
      .select("email")
      .ilike("email", userEmail)
      .limit(1);

    setUserState({
      email: userEmail,
      isAdmin: !error && Boolean(adminRows?.length),
      loading: false,
    });
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    await checkSession();
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUserState({ email: null, isAdmin: false, loading: false });
  }

  function updateClubName(value: string) {
    setClubName(value);
    if (!slug || slug === slugify(clubName)) {
      setSlug(slugify(value));
    }
  }

  function updateLeague(index: number, patch: Partial<LeagueDraft>) {
    setLeagues((current) => current.map((league, i) => (i === index ? { ...league, ...patch } : league)));
  }

  function addLeague() {
    setLeagues((current) => [...current, { name: `Division ${current.length + 1}`, teamsPerLeague: 8 }]);
  }

  function removeLeague(index: number) {
    setLeagues((current) => current.filter((_, i) => i !== index));
  }

  function applyRulePreset(value: string) {
    setRulePreset(value);

    if (value === "standard") {
      setScheduleStyle("weekly");
      setScoreFormat("Best of 3 sets");
      setFixtureRules(DEFAULT_RULE_TEXT.fixtureRules);
      setDeadlineRules(DEFAULT_RULE_TEXT.deadlineRules);
      setForfeitRules(DEFAULT_RULE_TEXT.forfeitRules);
      setResultSubmissionRules(DEFAULT_RULE_TEXT.resultSubmissionRules);
      setCaptainConfirmationRules(DEFAULT_RULE_TEXT.captainConfirmationRules);
      setLeagueCupRules(DEFAULT_RULE_TEXT.leagueCupRules);
    }

    if (value === "monthly_pack") {
      setScheduleStyle("monthly_pack");
      setScoreFormat("Best of 3 sets");
      setFixtureRules("Each team receives a monthly fixture pack and may play those matches in any order before the monthly deadline.");
      setDeadlineRules("All matches in the pack must be completed by the final day of the fixture pack unless the organiser grants an extension.");
      setForfeitRules(DEFAULT_RULE_TEXT.forfeitRules);
    }

    if (value === "fast4") {
      setScoreFormat("Fast4");
      setFixtureRules("Fast4 scoring is used for shorter match windows, cup days or one-day club events.");
      setDeadlineRules("Matches must be completed within the event or fixture deadline set by the organiser.");
      setForfeitRules("Late arrival, non-attendance or failure to arrange may result in a forfeit at the organiser's discretion.");
    }

    if (value === "box_league") {
      setScheduleStyle("custom_pack");
      setScoreFormat("Box league format");
      setFixtureRules("Players or teams are grouped into boxes. Each box completes its assigned matches before the deadline.");
      setDeadlineRules("Box matches must be completed by the published box deadline.");
      setForfeitRules("Unplayed matches may be recorded as 0 points or organiser decision depending on club policy.");
    }
  }

  async function createClubSetup() {
    setSubmitError(null);
    setSubmitMessage(null);
    setCreatedSummary(null);

    if (!userState.isAdmin) {
      setSubmitError("You must be logged in as an admin to create a club setup.");
      return;
    }

    const cleanSlug = slugify(slug || clubName);
    const cleanLeagues = leagues
      .map((league) => ({ ...league, name: league.name.trim(), teamsPerLeague: Number(league.teamsPerLeague) || 8 }))
      .filter((league) => league.name.length > 0);

    if (!clubName.trim() || !cleanSlug) {
      setSubmitError("Club name and slug are required.");
      setStep(1);
      return;
    }

    if (!cleanLeagues.length) {
      setSubmitError("Add at least one league/division.");
      setStep(3);
      return;
    }

    setSubmitting(true);

    try {
      const { data: club, error: clubError } = await supabase
        .from("clubs")
        .upsert(
          {
            slug: cleanSlug,
            name: clubName.trim(),
            short_name: shortName.trim() || null,
            logo_url: logoUrl.trim() || null,
            primary_color: primaryColor,
            secondary_color: secondaryColor,
            accent_color: accentColor,
            contact_email: contactEmail.trim() || null,
            website_url: websiteUrl.trim() || null,
            instagram_url: instagramUrl.trim() || null,
            facebook_url: facebookUrl.trim() || null,
            welcome_title: welcomeTitle.trim() || null,
            welcome_text: welcomeText.trim() || null,
            footer_text: footerText.trim() || null,
            is_active: true,
          },
          { onConflict: "slug" }
        )
        .select("id, slug, name")
        .single();

      if (clubError) throw clubError;
      if (!club?.id) throw new Error("Club was not created.");

      const { data: season, error: seasonError } = await supabase
        .from("seasons")
        .insert({
          club_id: club.id,
          name: seasonName.trim() || "Opening Season",
          status: "active",
          starts_on: seasonStart || null,
          ends_on: seasonEnd || null,
        })
        .select("id, name")
        .single();

      if (seasonError) throw seasonError;
      if (!season?.id) throw new Error("Season was not created.");

      const divisionsPayload = cleanLeagues.map((league, index) => ({
        season_id: season.id,
        name: league.name,
        sort_order: index + 1,
      }));

      const { data: createdDivisions, error: divisionsError } = await supabase
        .from("divisions")
        .insert(divisionsPayload)
        .select("id, name, sort_order");

      if (divisionsError) throw divisionsError;

      const { error: setupProfileError } = await supabase.from("club_setup_profiles").insert({
        club_id: club.id,
        season_id: season.id,
        schedule_style: scheduleStyle,
        fixtures_per_pack: Number(fixturesPerPack) || 3,
        win_points: Number(winPoints) || 3,
        draw_points: Number(drawPoints) || 1,
        loss_points: Number(lossPoints) || 0,
        forfeit_win_points: Number(forfeitWinPoints) || 3,
        default_teams_per_league: cleanLeagues[0]?.teamsPerLeague ?? 8,
        notes: "Created by Rallora onboarding wizard.",
      });

      if (setupProfileError) {
        // Non-critical: core setup is already created.
        console.warn("club_setup_profiles insert failed", setupProfileError.message);
      }

      const { error: rulesError } = await supabase.from("club_rules").upsert(
        {
          club_id: club.id,
          season_id: season.id,
          rule_preset: rulePreset,
          score_format: scoreFormat.trim() || null,
          win_points: Number(winPoints) || 3,
          draw_points: Number(drawPoints) || 1,
          loss_points: Number(lossPoints) || 0,
          forfeit_win_points: Number(forfeitWinPoints) || 3,
          forfeit_loss_points: Number(forfeitLossPoints) || 0,
          double_forfeit_points: Number(doubleForfeitPoints) || 0,
          standings_tiebreaker: standingsTiebreaker.trim() || null,
          fixture_rules: fixtureRules.trim() || null,
          deadline_rules: deadlineRules.trim() || null,
          forfeit_rules: forfeitRules.trim() || null,
          result_submission_rules: resultSubmissionRules.trim() || null,
          captain_confirmation_rules: captainConfirmationRules.trim() || null,
          league_cup_rules: leagueCupRules.trim() || null,
          custom_rules: customRules.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "club_id,season_id" }
      );

      if (rulesError) {
        // Non-critical: core setup is already created.
        console.warn("club_rules insert failed", rulesError.message);
      }

      if (createDemoSetup) {
        const { error: demoError } = await supabase.rpc("load_onboarding_demo_data", {
          p_club_id: club.id,
          p_season_id: season.id,
          p_teams_per_league: Math.max(4, Math.min(12, Math.round(cleanLeagues[0]?.teamsPerLeague ?? 8))),
          p_fixtures_per_team: Number(fixturesPerPack) || 3,
        });

        if (demoError) throw new Error(`Club was created, but demo setup failed: ${demoError.message}`);
      }

      setCreatedSummary({
        clubName: club.name,
        clubSlug: club.slug,
        seasonName: season.name,
        leaguesCreated: createdDivisions?.map((division) => division.name) ?? cleanLeagues.map((league) => league.name),
      });
      setSubmitMessage(createDemoSetup ? "Club setup and demo data created successfully." : "Club setup created successfully.");
      setStep(5);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong creating the club setup.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const steps = [
    { id: 1, label: "Club", icon: Building2 },
    { id: 2, label: "Branding", icon: Palette },
    { id: 3, label: "Leagues", icon: Trophy },
    { id: 4, label: "Rules", icon: Settings2 },
    { id: 5, label: "Finish", icon: CheckCircle2 },
  ];

  if (userState.loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="flex items-center gap-3 rounded-3xl bg-white px-6 py-5 text-slate-700 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Loading onboarding wizard...
        </div>
      </main>
    );
  }

  if (!userState.email || !userState.isAdmin) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-4 text-white sm:p-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
          <div className="grid w-full gap-6 lg:grid-cols-[1fr_0.9fr]">
            <section className="rounded-[2rem] border border-white/10 bg-white/10 p-8 backdrop-blur-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/30 bg-blue-500/15 px-4 py-2 text-sm font-black uppercase tracking-wide text-blue-100">
                <Sparkles className="h-4 w-4" /> Rallora setup wizard
              </div>
              <h1 className="mt-6 text-5xl font-black uppercase leading-none tracking-tight sm:text-6xl">
                Set up a new club in minutes.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-white/70">
                Create a branded club hub, league structure, season and rule defaults ready for fixture generation and sponsor setup.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  "Club profile and branding",
                  "League/division structure",
                  "Weekly or monthly fixture style",
                  "Rules and scoring defaults",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-white/80">
                    <CheckCircle2 className="mb-3 h-5 w-5 text-blue-300" /> {item}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-blue-600 p-3 text-white">
                  <LogIn className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase">Admin Login</h2>
                  <p className="text-sm text-slate-500">Use an existing Rallora admin account.</p>
                </div>
              </div>

              {!userState.isAdmin && userState.email ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  You are logged in as {userState.email}, but this user is not listed in admin_users.
                  <button onClick={signOut} className="mt-3 block rounded-xl bg-amber-600 px-4 py-2 text-white">Sign out</button>
                </div>
              ) : (
                <form onSubmit={signIn} className="space-y-4">
                  <div>
                    <FieldLabel>Email</FieldLabel>
                    <TextInput value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="admin@club.com" />
                  </div>
                  <div>
                    <FieldLabel>Password</FieldLabel>
                    <TextInput value={password} onChange={(event) => setPassword(event.target.value)} type="password" required placeholder="Password" />
                  </div>
                  {authError && <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{authError}</div>}
                  <button disabled={authLoading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 font-black uppercase text-white shadow-lg shadow-blue-600/20 disabled:opacity-50">
                    {authLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />} Login
                  </button>
                </form>
              )}
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/30 bg-blue-500/15 px-4 py-2 text-sm font-black uppercase tracking-wide text-blue-100">
                <Sparkles className="h-4 w-4" /> Rallora onboarding
              </div>
              <h1 className="mt-4 text-4xl font-black uppercase tracking-tight sm:text-5xl">Club Onboarding Wizard</h1>
              <p className="mt-2 max-w-2xl text-white/65">Create the foundation for a new club tenant: club profile, branding, first season, leagues and rule defaults.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-white/75">
              Logged in as <span className="font-black text-white">{userState.email}</span>
              <button onClick={signOut} className="ml-3 rounded-xl bg-white/10 px-3 py-2 text-xs font-black uppercase text-white hover:bg-white/20">Sign out</button>
            </div>
          </div>
        </header>

        <div className="mb-6 grid gap-3 md:grid-cols-5">
          {steps.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setStep(id)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${step === id ? "border-blue-200 bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "border-slate-200 bg-white text-slate-700 hover:border-blue-200"}`}
            >
              <Icon className="h-5 w-5" />
              <div>
                <div className="text-xs font-black uppercase opacity-70">Step {id}</div>
                <div className="font-black uppercase">{label}</div>
              </div>
            </button>
          ))}
        </div>

        {submitError && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /> {submitError}
          </div>
        )}
        {submitMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> {submitMessage}
          </div>
        )}

        {step === 1 && (
          <Panel>
            <div className="mb-5 flex items-center gap-3">
              <Building2 className="h-7 w-7 text-blue-600" />
              <div>
                <h2 className="text-2xl font-black uppercase">Club details</h2>
                <p className="text-sm text-slate-500">This becomes the branded club tenant inside Rallora.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Club name</FieldLabel>
                <TextInput value={clubName} onChange={(event) => updateClubName(event.target.value)} />
              </div>
              <div>
                <FieldLabel>Short name</FieldLabel>
                <TextInput value={shortName} onChange={(event) => setShortName(event.target.value)} />
              </div>
              <div>
                <FieldLabel>Club URL slug</FieldLabel>
                <TextInput value={slug} onChange={(event) => setSlug(slugify(event.target.value))} />
              </div>
              <div>
                <FieldLabel>Contact email</FieldLabel>
                <TextInput value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} type="email" />
              </div>
              <div>
                <FieldLabel>Website URL</FieldLabel>
                <TextInput value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://..." />
              </div>
              <div>
                <FieldLabel>Instagram URL</FieldLabel>
                <TextInput value={instagramUrl} onChange={(event) => setInstagramUrl(event.target.value)} placeholder="https://instagram.com/..." />
              </div>
              <div>
                <FieldLabel>Facebook URL</FieldLabel>
                <TextInput value={facebookUrl} onChange={(event) => setFacebookUrl(event.target.value)} placeholder="https://facebook.com/..." />
              </div>
            </div>
          </Panel>
        )}

        {step === 2 && (
          <Panel>
            <div className="mb-5 flex items-center gap-3">
              <Palette className="h-7 w-7 text-blue-600" />
              <div>
                <h2 className="text-2xl font-black uppercase">Branding</h2>
                <p className="text-sm text-slate-500">Set the public look and language for the club hub.</p>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
              <div className="space-y-4">
                <div>
                  <FieldLabel>Logo URL</FieldLabel>
                  <TextInput value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} placeholder="/gsm-logo.png or uploaded logo URL" />
                </div>
                <div>
                  <FieldLabel>Welcome title</FieldLabel>
                  <TextInput value={welcomeTitle} onChange={(event) => setWelcomeTitle(event.target.value)} />
                </div>
                <div>
                  <FieldLabel>Welcome text</FieldLabel>
                  <TextArea value={welcomeText} onChange={(event) => setWelcomeText(event.target.value)} />
                </div>
                <div>
                  <FieldLabel>Footer text</FieldLabel>
                  <TextInput value={footerText} onChange={(event) => setFooterText(event.target.value)} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                  <div>
                    <FieldLabel>Primary colour</FieldLabel>
                    <TextInput value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} type="color" />
                  </div>
                  <div>
                    <FieldLabel>Secondary colour</FieldLabel>
                    <TextInput value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value)} type="color" />
                  </div>
                  <div>
                    <FieldLabel>Accent colour</FieldLabel>
                    <TextInput value={accentColor} onChange={(event) => setAccentColor(event.target.value)} type="color" />
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 p-5" style={{ background: `linear-gradient(135deg, ${secondaryColor}, ${primaryColor})` }}>
                  <div className="rounded-2xl bg-white/90 p-4">
                    <div className="text-xs font-black uppercase tracking-wide" style={{ color: primaryColor }}>{shortName || "Club"}</div>
                    <div className="mt-2 text-2xl font-black uppercase text-slate-950">{clubName || "Club Name"}</div>
                    <p className="mt-2 text-sm text-slate-600">{welcomeText}</p>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        )}

        {step === 3 && (
          <Panel>
            <div className="mb-5 flex items-center gap-3">
              <Trophy className="h-7 w-7 text-blue-600" />
              <div>
                <h2 className="text-2xl font-black uppercase">Season and leagues</h2>
                <p className="text-sm text-slate-500">Create the first active season and league/division structure.</p>
              </div>
            </div>
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <div>
                <FieldLabel>Season name</FieldLabel>
                <TextInput value={seasonName} onChange={(event) => setSeasonName(event.target.value)} />
              </div>
              <div>
                <FieldLabel>Season start</FieldLabel>
                <TextInput value={seasonStart} onChange={(event) => setSeasonStart(event.target.value)} type="date" />
              </div>
              <div>
                <FieldLabel>Season end</FieldLabel>
                <TextInput value={seasonEnd} onChange={(event) => setSeasonEnd(event.target.value)} type="date" />
              </div>
            </div>
            <div className="space-y-3">
              {leagues.map((league, index) => (
                <div key={`${league.name}-${index}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_160px_auto] md:items-end">
                  <div>
                    <FieldLabel>League / division name</FieldLabel>
                    <TextInput value={league.name} onChange={(event) => updateLeague(index, { name: event.target.value })} />
                  </div>
                  <div>
                    <FieldLabel>Teams target</FieldLabel>
                    <TextInput value={league.teamsPerLeague} min={2} max={32} type="number" onChange={(event) => updateLeague(index, { teamsPerLeague: Number(event.target.value) })} />
                  </div>
                  <button onClick={() => removeLeague(index)} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black uppercase text-red-700 hover:bg-red-100">Remove</button>
                </div>
              ))}
            </div>
            <button onClick={addLeague} className="mt-4 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black uppercase text-white">Add league</button>
          </Panel>
        )}

        {step === 4 && (
          <Panel>
            <div className="mb-5 flex items-center gap-3">
              <Settings2 className="h-7 w-7 text-blue-600" />
              <div>
                <h2 className="text-2xl font-black uppercase">Rules and scoring</h2>
                <p className="text-sm text-slate-500">Choose a preset, then edit the public club rules to match how this club runs leagues.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <FieldLabel>Rules preset</FieldLabel>
                <Select value={rulePreset} onChange={(event) => applyRulePreset(event.target.value)}>
                  {RULE_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>{preset.label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <FieldLabel>Fixture style</FieldLabel>
                <Select value={scheduleStyle} onChange={(event) => setScheduleStyle(event.target.value)}>
                  <option value="weekly">Weekly rounds</option>
                  <option value="monthly_pack">Monthly fixture pack</option>
                  <option value="custom_pack">Custom fixture pack</option>
                </Select>
              </div>
              <div>
                <FieldLabel>Score format</FieldLabel>
                <TextInput value={scoreFormat} onChange={(event) => setScoreFormat(event.target.value)} placeholder="Example: Best of 3 sets / Fast4" />
              </div>
              <div>
                <FieldLabel>Fixtures per pack</FieldLabel>
                <TextInput value={fixturesPerPack} type="number" min={1} max={10} onChange={(event) => setFixturesPerPack(Number(event.target.value))} />
              </div>
              <div>
                <FieldLabel>Win points</FieldLabel>
                <TextInput value={winPoints} type="number" min={0} max={10} onChange={(event) => setWinPoints(Number(event.target.value))} />
              </div>
              <div>
                <FieldLabel>Draw points</FieldLabel>
                <TextInput value={drawPoints} type="number" min={0} max={10} onChange={(event) => setDrawPoints(Number(event.target.value))} />
              </div>
              <div>
                <FieldLabel>Loss points</FieldLabel>
                <TextInput value={lossPoints} type="number" min={0} max={10} onChange={(event) => setLossPoints(Number(event.target.value))} />
              </div>
              <div>
                <FieldLabel>Forfeit win points</FieldLabel>
                <TextInput value={forfeitWinPoints} type="number" min={0} max={10} onChange={(event) => setForfeitWinPoints(Number(event.target.value))} />
              </div>
              <div>
                <FieldLabel>Forfeit loss points</FieldLabel>
                <TextInput value={forfeitLossPoints} type="number" min={-10} max={10} onChange={(event) => setForfeitLossPoints(Number(event.target.value))} />
              </div>
              <div>
                <FieldLabel>Double forfeit points</FieldLabel>
                <TextInput value={doubleForfeitPoints} type="number" min={-10} max={10} onChange={(event) => setDoubleForfeitPoints(Number(event.target.value))} />
              </div>
              <div className="lg:col-span-3">
                <FieldLabel>Standings tie-breaker order</FieldLabel>
                <TextInput value={standingsTiebreaker} onChange={(event) => setStandingsTiebreaker(event.target.value)} />
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Fixture arrangement rules</FieldLabel>
                <TextArea value={fixtureRules} onChange={(event) => setFixtureRules(event.target.value)} />
              </div>
              <div>
                <FieldLabel>Deadline rules</FieldLabel>
                <TextArea value={deadlineRules} onChange={(event) => setDeadlineRules(event.target.value)} />
              </div>
              <div>
                <FieldLabel>Forfeit rules</FieldLabel>
                <TextArea value={forfeitRules} onChange={(event) => setForfeitRules(event.target.value)} />
              </div>
              <div>
                <FieldLabel>Result submission rules</FieldLabel>
                <TextArea value={resultSubmissionRules} onChange={(event) => setResultSubmissionRules(event.target.value)} />
              </div>
              <div>
                <FieldLabel>Captain confirmation rules</FieldLabel>
                <TextArea value={captainConfirmationRules} onChange={(event) => setCaptainConfirmationRules(event.target.value)} />
              </div>
              <div>
                <FieldLabel>League Cup rules</FieldLabel>
                <TextArea value={leagueCupRules} onChange={(event) => setLeagueCupRules(event.target.value)} />
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-blue-200 bg-blue-50 p-5">
              <FieldLabel>Custom extra rules / club notes</FieldLabel>
              <TextArea
                value={customRules}
                onChange={(event) => setCustomRules(event.target.value)}
                placeholder="Add anything unique to this club, such as court booking rules, payment rules, late arrival policy, juniors/adaptive rules, or sponsor/event notes."
              />
              <p className="mt-3 text-sm font-semibold text-blue-900/70">These rules are stored against the club and can later power the public Rules page and club admin settings.</p>
            </div>
          </Panel>
        )}

        {step === 5 && (
          <Panel>
            <div className="mb-5 flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 text-blue-600" />
              <div>
                <h2 className="text-2xl font-black uppercase">Review and create</h2>
                <p className="text-sm text-slate-500">Create the club tenant, first season and leagues.</p>
              </div>
            </div>
            {createdSummary ? (
              <div className="rounded-[1.5rem] border border-green-200 bg-green-50 p-5 text-green-900">
                <h3 className="text-xl font-black uppercase">Created successfully</h3>
                <p className="mt-2 text-sm font-bold">{createdSummary.clubName} has been created with slug <span className="font-black">{createdSummary.clubSlug}</span>.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4">
                    <div className="text-xs font-black uppercase text-green-700">Season</div>
                    <div className="font-black">{createdSummary.seasonName}</div>
                  </div>
                  <div className="rounded-2xl bg-white p-4">
                    <div className="text-xs font-black uppercase text-green-700">Leagues</div>
                    <div className="font-black">{createdSummary.leaguesCreated.join(", ")}</div>
                  </div>
                  <div className="rounded-2xl bg-white p-4 md:col-span-2">
                    <div className="text-xs font-black uppercase text-green-700">Demo setup</div>
                    <div className="font-black">{createDemoSetup ? "Teams, fixtures, results, sponsors and cup rules loaded" : "Skipped"}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <h3 className="font-black uppercase">Setup summary</h3>
                  <dl className="mt-4 grid gap-3 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Club</dt><dd className="font-black">{clubName}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Slug</dt><dd className="font-black">{slugify(slug || clubName)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Season</dt><dd className="font-black">{seasonName}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Fixture style</dt><dd className="font-black">{scheduleStyle.replace("_", " ")}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Rules preset</dt><dd className="font-black">{RULE_PRESETS.find((preset) => preset.value === rulePreset)?.label ?? "Custom Rules"}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Score format</dt><dd className="font-black">{scoreFormat || "Custom"}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Leagues</dt><dd className="font-black">{leagues.filter((league) => league.name.trim()).length}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Demo setup</dt><dd className="font-black">{createDemoSetup ? "Included" : "Skipped"}</dd></div>
                  </dl>
                  <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-200 bg-white p-4 text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={createDemoSetup}
                      onChange={(event) => setCreateDemoSetup(event.target.checked)}
                      className="mt-1 h-5 w-5"
                    />
                    <span>
                      <span className="block font-black uppercase text-blue-950">Create demo setup</span>
                      <span className="mt-1 block text-slate-500">
                        Adds demo teams, captains, fixtures, two rounds of results, standings, sponsors and cup qualifier rules for sales demos.
                      </span>
                    </span>
                  </label>
                </div>
                <div className="rounded-[1.5rem] border border-blue-200 bg-blue-50 p-5">
                  <Users className="h-8 w-8 text-blue-600" />
                  <h3 className="mt-3 font-black uppercase text-blue-950">What happens next?</h3>
                  <p className="mt-2 text-sm font-semibold text-blue-900/70">
                    {createDemoSetup
                      ? "This club will be ready to demo immediately with teams, fixtures, results, standings, sponsors and cup setup."
                      : "After creation, go to the main admin area to add teams, captains, sponsors, fixtures and results."}
                  </p>
                </div>
              </div>
            )}
          </Panel>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={step === 1}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-black uppercase text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-5 w-5" /> Back
          </button>

          {step < 5 ? (
            <button
              onClick={() => setStep((current) => Math.min(5, current + 1))}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-black uppercase text-white shadow-lg shadow-blue-600/20"
            >
              Next <ArrowRight className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={createClubSetup}
              disabled={submitting || Boolean(createdSummary)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-black uppercase text-white shadow-lg shadow-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} Create Club Setup
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
