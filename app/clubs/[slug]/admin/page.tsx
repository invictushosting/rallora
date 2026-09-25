"use client";

import RalloraLogo from "@/app/components/rallora-logo";
import Loading from "@/app/loading";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import styles from "./admin.module.css";
import ClubEditor, { type EditableClub, type EditableSeason } from "./club-editor";
import PrizePlanner from "./prize-planner";
import PaymentSetup from "./payment-setup";

type Club = EditableClub;
type LeagueRule = { key:string; label:string; text:string; enabled:boolean; custom?:boolean };
type Season = { id: string; club_id: string; name: string; status: string; fixture_schedule_mode: "weekly" | "date_window"; registration_opens_at:string|null; registration_closes_at:string|null; league_format:"standard"|"promotion_relegation_cycles"; teams_per_division:number|null; matches_per_cycle:number|null; division_assignment_mode:"manual"|"combined_rating"; max_divisions:number|null; allow_overflow_when_uneven:boolean; promotion_places:number; relegation_places:number; cycle_match_mode:"single_round_robin"|"double_round_robin"; require_cycle_completion:boolean; league_rules:LeagueRule[] };
type Membership = { club_id: string; user_id: string; role: string; status: string };
type DivisionSummary = { id: string; name: string; sort_order: number;
  teams: { id: string; name: string }[] };
type AdminFixture = { id:string; season_id:string; division_id:string; home_team_id:string; away_team_id:string; week_number:number; play_by:string; status:string; home_score?:string|null; away_score?:string|null; winner_team_id?:string|null };
type Summary = {
  season: Season;
  divisions: number;
  teams: number;
  fixtures: number;
  confirmed: number;
  outstanding: number;
  awaitingResult: number;
  overdue: number;
  registrations: number;
  divisionSummaries: DivisionSummary[];
};
type PlaytomicBooking = { matched_fixture_id:string|null; matched_player_count:number; match_state:"unmatched"|"possible"|"confirmed"|"ignored"; booking_status:string; starts_at:string; ends_at:string; court:string|null };
type View =
  | { status: "loading" | "signed_out" | "forbidden" | "missing" }
  | { status: "error"; message: string }
  | { status: "ready"; club: Club; role: string; summaries: Summary[]; sponsors: number; fixtures: AdminFixture[]; playtomicConnected: boolean; playtomicBookings: PlaytomicBooking[] };

export default function ClubAdministration() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<View>({ status: "loading" });
  const [revision, setRevision] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState("");
  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSignInError("");
    setSignInLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setPassword("");
      // onAuthStateChange refreshes membership-checked club state.
    } catch (error) {
      setSignInError(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setSignInLoading(false);
    }
  }
  async function signOut() {
    await supabase.auth.signOut();
    setView({ status: "signed_out" });
  }

  async function setPlaytomicLater(skip:boolean) {
    if (view.status !== "ready") return;
    const { error } = await supabase.from("clubs")
      .update({ playtomic_setup_choice: skip ? "later" : null })
      .eq("id", view.club.id);
    if (!error) setRevision((value)=>value+1);
  }

  useEffect(() => {
    let alive = true;

    async function load(options?: { showLoading?: boolean }) {
      if (alive && options?.showLoading) setView({ status: "loading" });
      try {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          if (alive) setView({ status: "missing" });
          return;
        }
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError && authError.name !== "AuthSessionMissingError") throw authError;
        if (!user) {
          if (alive) setView({ status: "signed_out" });
          return;
        }

        const { data: club, error: clubError } = await supabase
          .from("clubs")
          .select("id,slug,name,short_name,primary_color,welcome_text,logo_url,cover_image_url,website_url,contact_email,venue_name,address_line_1,town,postcode,player_registration_terms,playtomic_setup_choice")
          .eq("slug", slug).maybeSingle();
        if (clubError) throw clubError;
        if (!club) {
          if (alive) setView({ status: "missing" });
          return;
        }

        // Access is based on the verified Supabase Auth user ID, not email or URL.
        // A club member can only inspect their own club; a platform admin can oversee all clubs.
        const [memberReply, platformReply] = await Promise.all([
          supabase.from("rallora_club_memberships")
            .select("club_id,user_id,role,status")
            .eq("club_id", club.id).eq("user_id", user.id)
            .eq("status", "active").maybeSingle(),
          supabase.from("rallora_platform_admins")
            .select("user_id").eq("user_id", user.id).maybeSingle(),
        ]);
        if (memberReply.error) throw memberReply.error;
        if (platformReply.error) throw platformReply.error;
        const member = memberReply.data as Membership | null;
        const isPlatformAdmin = Boolean(platformReply.data?.user_id === user.id);
        const isClubMember = Boolean(
          member && member.club_id === club.id && member.user_id === user.id &&
          member.status === "active" &&
          ["owner", "admin", "organiser"].includes(member.role),
        );
        if (!isClubMember && !isPlatformAdmin) {
          if (alive) setView({ status: "forbidden" });
          return;
        }

        const [seasonReply, sponsorReply, playtomicReply, bookingReply] = await Promise.all([
          supabase.from("seasons").select("id,club_id,name,status,fixture_schedule_mode,registration_opens_at,registration_closes_at,league_format,teams_per_division,matches_per_cycle,division_assignment_mode,max_divisions,allow_overflow_when_uneven,promotion_places,relegation_places,cycle_match_mode,require_cycle_completion,league_rules")
            .eq("club_id", club.id).order("created_at", { ascending: false }),
          supabase.from("sponsors").select("id", { count: "exact", head: true })
            .eq("club_id", club.id).eq("is_active", true),
          supabase.from("rallora_club_integrations").select("status")
            .eq("club_id", club.id).eq("provider","playtomic").maybeSingle(),
          supabase.from("rallora_playtomic_bookings").select("matched_fixture_id,matched_player_count,match_state,booking_status,starts_at,ends_at,court")
            .eq("club_id", club.id),
        ]);
        if (seasonReply.error) throw seasonReply.error;
        if (sponsorReply.error) throw sponsorReply.error;
        if (playtomicReply.error) throw playtomicReply.error;
        if (bookingReply.error) throw bookingReply.error;

        const seasons = ((seasonReply.data ?? []) as Season[])
          .filter((season) => season.club_id === club.id);
        const allFixtures: AdminFixture[] = [];
        const summaries = await Promise.all(seasons.map(async (season) => {
          const [divisionReply, fixtureReply, registrationReply] = await Promise.all([
            supabase.from("divisions").select("id,name,sort_order")
              .eq("season_id", season.id).order("sort_order", { ascending: true }),
            supabase.from("fixtures").select("id,season_id,division_id,home_team_id,away_team_id,week_number,play_by,status")
              .eq("season_id", season.id),
            supabase.from("rallora_team_applications").select("id",{count:"exact",head:true})
              .eq("season_id", season.id).in("status",["pending","approved"]),
          ]);
          if (divisionReply.error) throw divisionReply.error;
          if (fixtureReply.error) throw fixtureReply.error;
          if (registrationReply.error) throw registrationReply.error;

          const divisionIds = (divisionReply.data ?? []).map((item) => item.id as string);
          const seasonFixtures = (fixtureReply.data ?? []) as AdminFixture[];
          allFixtures.push(...seasonFixtures);
          const fixtureIds = seasonFixtures.map((item) => item.id);
          const [teamsReply, resultsReply] = await Promise.all([
            divisionIds.length
              ? supabase.from("teams").select("id,division_id,name")
                  .in("division_id", divisionIds).order("name", { ascending: true })
              : Promise.resolve({ data: [] as { id: string; division_id: string; name: string }[], error: null }),
            fixtureIds.length
              ? supabase.from("results").select("fixture_id")
                  .in("fixture_id", fixtureIds).eq("status", "confirmed")
              : Promise.resolve({ data: [] as { fixture_id: string }[], error: null }),
          ]);
          if (teamsReply.error) throw teamsReply.error;
          if (resultsReply.error) throw resultsReply.error;
          const knownFixtureIds = new Set(fixtureIds);
          const roster = (teamsReply.data ?? []) as { id: string; division_id: string; name: string }[];
          const divisionSummaries: DivisionSummary[] = (divisionReply.data ?? [])
            .map((division) => ({
              id: division.id as string,
              name: division.name as string,
              sort_order: division.sort_order as number,
              teams: roster.filter((team) => team.division_id === division.id)
                .map((team) => ({ id: team.id, name: team.name })),
            }));
          return {
            season,
            divisions: divisionIds.length,
            teams: roster.length,
            fixtures: fixtureIds.length,
            confirmed: (resultsReply.data ?? [])
              .filter((result) => knownFixtureIds.has(result.fixture_id)).length,
            outstanding: seasonFixtures.filter((fixture) => !["confirmed","cancelled"].includes(fixture.status)).length,
            awaitingResult: seasonFixtures.filter((fixture) => fixture.status === "played" || fixture.status === "awaiting_result").length,
            overdue: seasonFixtures.filter((fixture) => !["confirmed","cancelled"].includes(fixture.status) && fixture.play_by && fixture.play_by < new Date().toISOString().slice(0,10)).length,
            registrations: registrationReply.count ?? 0,
            divisionSummaries,
          };
        }));
        if (alive) setView({
          status: "ready",
          club: club as Club,
          role: isClubMember ? member!.role : "platform administrator",
          summaries,
          sponsors: sponsorReply.count ?? 0,
          fixtures: allFixtures,
          playtomicConnected: playtomicReply.data?.status === "connected",
          playtomicBookings: (bookingReply.data ?? []) as PlaytomicBooking[],
        });
      } catch (error) {
        if (alive) setView({
          status: "error",
          message: error instanceof Error ? error.message : "Could not load club administration.",
        });
      }
    }

    void load({ showLoading: revision === 0 });
    // Only reload after the Supabase callback completes, avoiding auth-client deadlocks.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void load({ showLoading: false }); }, 0);
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [slug, supabase, revision]);

  if (view.status === "loading") return <Loading />;

  if (view.status !== "ready") {
    const title = view.status === "signed_out" ? "Sign in required" :
      view.status === "forbidden" ? "Access denied" :
      view.status === "missing" ? "Club not found" : "Unable to load this club";
    const explanation = view.status === "signed_out"
      ? "Sign in to access this club’s administrative dashboard."
      : view.status === "forbidden"
        ? "Your account has no active administrative membership for this club."
        : view.status === "error" ? view.message
          : view.status === "missing" ? "This club could not be found." : "";
    return <main className={styles.page}><section className={styles.message} role="status">
      <RalloraLogo variant="light" width={214} /><h1>{title}</h1><p>{explanation}</p>
      {view.status === "signed_out" && <form className={styles.loginForm} onSubmit={signIn}>
        <label>Email<input type="email" autoComplete="username" required value={email}
          onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required
          value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {signInError && <p className={styles.loginError} role="alert">{signInError}</p>}
        <button type="submit" disabled={signInLoading}>{signInLoading ? "Signing in…" : "Sign in"}</button>
      </form>}
      <a href={`/clubs/${encodeURIComponent(slug)}`}>Back to club hub</a>
    </section></main>;
  }

  const totals = view.summaries.reduce((acc, item) => ({
    divisions: acc.divisions + item.divisions,
    teams: acc.teams + item.teams,
    fixtures: acc.fixtures + item.fixtures,
    confirmed: acc.confirmed + item.confirmed,
    outstanding: acc.outstanding + item.outstanding,
    awaitingResult: acc.awaitingResult + item.awaitingResult,
    overdue: acc.overdue + item.overdue,
  }), { divisions: 0, teams: 0, fixtures: 0, confirmed: 0, outstanding: 0, awaitingResult: 0, overdue: 0 });
  const confirmedBookings = view.playtomicBookings.filter((booking)=>booking.match_state==="confirmed" && booking.matched_player_count===4);
  const bookedFixtureIds = new Set(confirmedBookings.filter((booking)=>booking.booking_status!=="CANCELED").map((booking)=>booking.matched_fixture_id).filter(Boolean));
  const possibleBookings = view.playtomicBookings.filter((booking)=>booking.match_state==="possible" && booking.matched_player_count===3).length;
  const finishedWithoutResult = confirmedBookings.filter((booking)=>booking.booking_status==="FINISHED" && booking.matched_fixture_id && !view.fixtures.some((fixture)=>fixture.id===booking.matched_fixture_id && fixture.status==="confirmed")).length;
  const activeSeason = view.summaries.find(({season})=>season.status==="active");
  const registrationReady = Boolean(activeSeason && activeSeason.divisions>0);
  const playtomicDeferred = view.club.playtomic_setup_choice === "later";
  const playtomicSetupDone = view.playtomicConnected || playtomicDeferred;
  const launchSteps = [
    {label:"Brand your club",done:Boolean(view.club.logo_url && view.club.cover_image_url && view.club.welcome_text),hint:"Add your logo, cover image and welcome message.",tab:"branding" as const,action:"Start branding"},
    {label:"Create your first season",done:view.summaries.length>0,hint:"Create a draft season before anything goes live.",tab:"seasons" as const,action:"Create season"},
    {label:"Add divisions",done:totals.divisions>0,hint:"Set up the divisions your teams will compete in.",tab:"seasons" as const,action:"Add divisions"},
    {label:"Open team registration",done:registrationReady,hint:"Activate your season and open registration so players can enter their own teams.",tab:"registration" as const,action:registrationReady?"Review registration":"Prepare registration"},
  ];
  const launchComplete = launchSteps.every((step)=>step.done) && playtomicSetupDone;

  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.nav}>
      <Link href="/" className={styles.wordmark}><RalloraLogo variant="light" width={218} /></Link>
      <div className={styles.navActions}>
        <Link className={styles.profileAction} href={`/account?club=${encodeURIComponent(view.club.slug)}`} aria-label="Open profile">
          <span className={styles.profileIcon} aria-hidden="true">●</span><span>Profile</span>
        </Link>
        <button className={styles.signOutAction} onClick={()=>void signOut()}>
          <span aria-hidden="true">↗</span><span>Sign out</span>
        </button>
        <span className={styles.badge}><span aria-hidden="true">◆</span> CLUB ADMIN</span>
      </div>
    </header>
    <section className={styles.hero}>
      <div className={styles.heroTop}><span className={styles.eyebrow}>YOUR CLUB CONTROL CENTRE</span><span className={styles.rolePill}>{view.role}</span></div>
      <h1>{view.club.name}</h1>
      <p>Everything you need to prepare, run and review your club competitions.</p>
      <div className={styles.heroActions}>
        <Link className={styles.primaryAction} href={`/clubs/${encodeURIComponent(view.club.slug)}/admin/registrations`}>Review registrations</Link>
        <a href={`/clubs/${encodeURIComponent(view.club.slug)}`}>View public hub</a>
      </div>
      <div className={styles.adminShortcuts}>
        <Link href={`/clubs/${encodeURIComponent(view.club.slug)}/admin/staff`}>Club staff</Link>
        <Link href={`/clubs/${encodeURIComponent(view.club.slug)}/admin/integrations`}>Integrations</Link>
        <Link href={`/clubs/${encodeURIComponent(view.club.slug)}/captain`}>Captain centre</Link>
        <Link href={`/clubs/${encodeURIComponent(view.club.slug)}/events`}>Events</Link>
        <Link href={`/clubs/${encodeURIComponent(view.club.slug)}/social`}>Social Studio</Link>
      </div>
    </section>
    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>CLUB OVERVIEW</span><h2>Your club at a glance</h2></div>
      <p>Live totals and season structure for {view.club.name}.</p></div>
    <section className={styles.metrics} aria-label="League operations overview">
      <article><span>Active leagues</span><strong>{view.summaries.filter(({season})=>season.status==="active").length}</strong><small>Currently being played</small></article>
      <article><span>Total fixtures</span><strong>{totals.fixtures}</strong><small>Across all leagues</small></article>
      <article><span>Outstanding</span><strong>{Math.max(0, totals.outstanding - bookedFixtureIds.size)}</strong><small>No confirmed booking yet</small></article>
      <article><span>Booked</span><strong>{bookedFixtureIds.size}</strong><small>Playtomic matched 4/4</small></article>
      <article><span>Awaiting result</span><strong>{Math.max(totals.awaitingResult, finishedWithoutResult)}</strong><small>Played, captain action needed</small></article>
      <article><span>Needs attention</span><strong>{totals.overdue + possibleBookings}</strong><small>{possibleBookings ? `${possibleBookings} possible 3/4 booking${possibleBookings===1?"":"s"} to review` : "Overdue fixtures"}</small></article>
      <article><span>Played</span><strong>{totals.confirmed}</strong><small>Confirmed results</small></article>
    </section>
    <div className={styles.sectionHeading}><h2>Club seasons</h2>
      <p>Each season below belongs to {view.club.name}.</p></div>
    <section className={styles.grid}>
      {view.summaries.map(({ season, divisions, teams, fixtures, confirmed, outstanding, awaitingResult, overdue, divisionSummaries }) =>
        <article className={styles.card} key={season.id}>
          <div className={styles.seasonCardTop}><span className={styles.status}>{season.status}</span>
            <button type="button" className={styles.seasonEdit} onClick={() => window.dispatchEvent(new CustomEvent("rallora:edit-season",{detail:{seasonId:season.id}}))}>Edit league</button>
          </div>
          <h3>{season.name}</h3>
          <div className={styles.numbers}>
            <span><strong>{divisions}</strong> divisions</span>
            <span><strong>{teams}</strong> teams</span>
            <span><strong>{fixtures}</strong> fixtures</span>
            <span><strong>{outstanding}</strong> outstanding</span>
            <span><strong>{awaitingResult}</strong> awaiting result</span>
            <span><strong>{confirmed}</strong> played</span>
          </div>
          <div className={styles.divisionList}>
            <h4>Divisions</h4>
            {divisionSummaries.map((division) => <div key={division.id} className={styles.divisionRow}>
              <div><strong>{division.name}</strong><span>{division.teams.length} teams</span></div>
            </div>)}
            {!divisionSummaries.length && <p>No divisions yet.</p>}
          </div>
          <a href={`/clubs/${encodeURIComponent(view.club.slug)}`}>View season in club hub →</a>
        </article>)}
      {!view.summaries.length && <article className={styles.card}>
        <h3>No seasons yet</h3><p>Club seasons will appear here when configured.</p>
      </article>}
    </section>
    <section className={`${styles.launchPanel} ${launchComplete ? styles.launchCompletePanel : ""}`}>
      {launchComplete ? <>
        <div className={styles.completeState}>
          <span className={styles.completeCheck}>✓</span>
          <div><span>SETUP COMPLETE</span><h2>Your club setup is complete</h2>
            <p>Your club is ready to launch: branding, season structure and team registration are configured. Playtomic is either connected or intentionally left for later.</p></div>
          <strong>5/5</strong>
        </div>
        <div className={styles.completeActions}>
          <button type="button" onClick={() => document.getElementById("club-management")?.scrollIntoView({behavior:"smooth",block:"start"})}>Review club setup ↓</button>
          <Link href={`/clubs/${encodeURIComponent(view.club.slug)}`}>View public hub →</Link>
        </div>
      </> : <>
        <div className={styles.launchHead}><div><span>GET STARTED</span><h2>Set up your club</h2>
          <p>Follow these steps to get your club ready. Each one takes you straight to the right setup area.</p></div>
          <strong>{launchSteps.filter(step=>step.done).length + (playtomicSetupDone?1:0)}/5</strong></div>
        <ol className={styles.launchList}>{launchSteps.map((step,index)=><li key={step.label} className={step.done?styles.launchDone:""}>
          <button className={styles.launchLink} type="button" onClick={() => {
            window.dispatchEvent(new CustomEvent("rallora:open-club-setup",{detail:{tab:step.tab}}));
          }}>
            <span className={styles.launchNumber}>{step.done?"✓":index+1}</span>
            <div className={styles.launchCopy}><strong>{step.label}</strong><p>{step.hint}</p></div>
            <span className={styles.launchCta}>{step.done?"Review":step.action} →</span>
          </button>
        </li>)}</ol>
        <div className={styles.playtomicSetup}>
          <div className={styles.playtomicSetupCopy}>
            <span className={playtomicSetupDone?styles.completeCheck:styles.launchNumber}>{playtomicSetupDone?"✓":"5"}</span>
            <div><strong>Connect Playtomic</strong>
              <p>{view.playtomicConnected
                ? "Playtomic is connected. You can manage or re-verify it from Integrations."
                : playtomicDeferred
                  ? "Skipped for now. You can connect Playtomic later from Integrations."
                  : "If your club has Playtomic API access, connect it now for player and rating sync."}</p></div>
          </div>
          <div className={styles.playtomicSetupActions}>
            <Link href={`/clubs/${encodeURIComponent(view.club.slug)}/admin/integrations`}>{view.playtomicConnected?"Manage integration":"Connect Playtomic"} →</Link>
            {!view.playtomicConnected && <label>
              <input type="checkbox" checked={playtomicDeferred}
                onChange={(event)=>void setPlaytomicLater(event.target.checked)} />
              I don’t have Playtomic API access — I’ll add this later
            </label>}
          </div>
        </div>
        {registrationReady && <div className={styles.launchActions}>
          <Link href={`/clubs/${encodeURIComponent(view.club.slug)}/register`}>Open team registration →</Link>
          <button type="button" onClick={()=>void navigator.clipboard.writeText(`${window.location.origin}/clubs/${view.club.slug}/register`)}>Copy registration link</button>
        </div>}
        {!registrationReady && <p className={styles.launchGate}>Team registration becomes available once you have an active season with at least one division.</p>}
      </>}
    </section>
    <ClubEditor
      club={view.club}
      seasons={view.summaries.map((summary): EditableSeason => ({
        id: summary.season.id, name: summary.season.name,
        club_id: summary.season.club_id, status: summary.season.status,
        fixture_schedule_mode: summary.season.fixture_schedule_mode,
        registration_opens_at: summary.season.registration_opens_at,
        registration_closes_at: summary.season.registration_closes_at,
        league_format: summary.season.league_format,
        teams_per_division: summary.season.teams_per_division,
        matches_per_cycle: summary.season.matches_per_cycle,
        division_assignment_mode: summary.season.division_assignment_mode,
        max_divisions: summary.season.max_divisions,
        allow_overflow_when_uneven: summary.season.allow_overflow_when_uneven,
        promotion_places: summary.season.promotion_places,
        relegation_places: summary.season.relegation_places,
        cycle_match_mode: summary.season.cycle_match_mode,
        require_cycle_completion: summary.season.require_cycle_completion,
        league_rules: summary.season.league_rules ?? [],
        registrations: summary.registrations,
        divisions: summary.divisionSummaries,
      }))}
      onSaved={() => setRevision((value) => value + 1)}
      fixtures={view.fixtures}
    />
    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>ADDITIONAL TOOLS</span><h2>More ways to run your club</h2></div>
      <p>These tools support your league once the core setup is in place.</p></div>
    <section className={styles.socialInvite}>
      <span>RALLORA SOCIAL</span><h2>Turn league updates into share-ready club stories.</h2>
      <p>Create news, prepare a confirmed result or weekly roundup, preview each channel
        and download a branded graphic. Manual sharing only for this first release.</p>
      <a href={`/clubs/${encodeURIComponent(view.club.slug)}/social`}>
        Open Content Studio ↗</a>
    </section>
    <PrizePlanner clubName={view.club.name}
      seasons={view.summaries.map(({season,teams})=>({
        id:season.id,name:season.name,status:season.status,teams,
      }))} />
    <PaymentSetup clubName={view.club.name}
      seasons={view.summaries.map(({season})=>({
        id:season.id,name:season.name,status:season.status,
      }))} />
    <p className={styles.note}>All changes are restricted to this club by verified membership and database permissions.</p>
  </div></main>;
}
