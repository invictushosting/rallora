"use client";

import RalloraLogo from "@/app/components/rallora-logo";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import styles from "./admin.module.css";
import ClubEditor, { type EditableClub, type EditableSeason } from "./club-editor";
import PrizePlanner from "./prize-planner";
import PaymentSetup from "./payment-setup";

type Club = EditableClub;
type Season = { id: string; club_id: string; name: string; status: string };
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
  divisionSummaries: DivisionSummary[];
};
type View =
  | { status: "loading" | "signed_out" | "forbidden" | "missing" }
  | { status: "error"; message: string }
  | { status: "ready"; club: Club; role: string; summaries: Summary[]; sponsors: number; fixtures: AdminFixture[] };

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

  useEffect(() => {
    let alive = true;

    async function load() {
      if (alive) setView({ status: "loading" });
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
          .select("id,slug,name,short_name,primary_color,welcome_text,logo_url,cover_image_url,website_url,contact_email,venue_name,address_line_1,town,postcode,player_registration_terms")
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

        const [seasonReply, sponsorReply] = await Promise.all([
          supabase.from("seasons").select("id,club_id,name,status")
            .eq("club_id", club.id).order("created_at", { ascending: false }),
          supabase.from("sponsors").select("id", { count: "exact", head: true })
            .eq("club_id", club.id).eq("is_active", true),
        ]);
        if (seasonReply.error) throw seasonReply.error;
        if (sponsorReply.error) throw sponsorReply.error;

        const seasons = ((seasonReply.data ?? []) as Season[])
          .filter((season) => season.club_id === club.id);
        const allFixtures: AdminFixture[] = [];
        const summaries = await Promise.all(seasons.map(async (season) => {
          const [divisionReply, fixtureReply] = await Promise.all([
            supabase.from("divisions").select("id,name,sort_order")
              .eq("season_id", season.id).order("sort_order", { ascending: true }),
            supabase.from("fixtures").select("id,season_id,division_id,home_team_id,away_team_id,week_number,play_by,status")
              .eq("season_id", season.id),
          ]);
          if (divisionReply.error) throw divisionReply.error;
          if (fixtureReply.error) throw fixtureReply.error;

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
        });
      } catch (error) {
        if (alive) setView({
          status: "error",
          message: error instanceof Error ? error.message : "Could not load club administration.",
        });
      }
    }

    void load();
    // Only reload after the Supabase callback completes, avoiding auth-client deadlocks.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void load(); }, 0);
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [slug, supabase, revision]);

  if (view.status !== "ready") {
    const title = view.status === "loading" ? "Loading club administration…" :
      view.status === "signed_out" ? "Sign in required" :
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
  }), { divisions: 0, teams: 0, fixtures: 0, confirmed: 0 });
  const launchSteps = [
    {label:"Brand your club",done:Boolean(view.club.logo_url && view.club.cover_image_url && view.club.welcome_text),hint:"Add your logo, cover image and welcome message.",href:`/clubs/${encodeURIComponent(view.club.slug)}/admin?setup=branding#club-management`,action:"Start branding"},
    {label:"Create your first season",done:view.summaries.length>0,hint:"Create a draft season before anything goes live.",href:`/clubs/${encodeURIComponent(view.club.slug)}/admin?setup=seasons#club-management`,action:"Create season"},
    {label:"Add divisions",done:totals.divisions>0,hint:"Set up the divisions your teams will compete in.",href:`/clubs/${encodeURIComponent(view.club.slug)}/admin?setup=seasons#club-management`,action:"Add divisions"},
    {label:"Open team registration",done:view.summaries.some(({season,divisions})=>season.status==="active"&&divisions>0),hint:"Activate a season with divisions, then open registration.",href:registrationReady?`/clubs/${encodeURIComponent(view.club.slug)}/register`:`/clubs/${encodeURIComponent(view.club.slug)}/admin?setup=seasons#club-management`,action:registrationReady?"Open registration":"Prepare registration"},
    {label:"Add or approve teams",done:totals.teams>0,hint:"Add teams manually or review teams that register.",href:registrationReady?`/clubs/${encodeURIComponent(view.club.slug)}/admin/registrations`:`/clubs/${encodeURIComponent(view.club.slug)}/admin?setup=teams#club-management`,action:registrationReady?"Review teams":"Add teams"},
    {label:"Publish fixtures",done:totals.fixtures>0,hint:"Create and publish fixtures once your team list is ready.",href:`/clubs/${encodeURIComponent(view.club.slug)}/admin?setup=fixtures#club-management`,action:"Create fixtures"},
  ];
  const launchComplete = launchSteps.every((step)=>step.done);
  const activeSeason = view.summaries.find(({season})=>season.status==="active");
  const registrationReady = Boolean(activeSeason && activeSeason.divisions>0);

  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.nav}>
      <Link href="/" className={styles.wordmark}><RalloraLogo variant="light" width={218} /></Link>
      <div className={styles.navActions}><button onClick={()=>void signOut()}>Sign out</button><span className={styles.badge}>CLUB ADMIN</span></div>
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
    <section className={styles.launchPanel}>
      <div className={styles.launchHead}><div><span>GET STARTED</span><h2>{launchComplete?"Your club is ready to go":"Set up your club"}</h2>
        <p>{launchComplete?"Your core setup is complete. You can keep refining it at any time.":"Follow these steps to get your club ready. Each one takes you straight to the right setup area."}</p></div>
        <strong>{launchSteps.filter(step=>step.done).length}/{launchSteps.length}</strong></div>
      <ol className={styles.launchList}>{launchSteps.map((step,index)=><li key={step.label} className={step.done?styles.launchDone:""}>
        <Link className={styles.launchLink} href={step.href}>
          <span className={styles.launchNumber}>{step.done?"✓":index+1}</span>
          <div className={styles.launchCopy}><strong>{step.label}</strong><p>{step.hint}</p></div>
          <span className={styles.launchCta}>{step.done?"Review":step.action} →</span>
        </Link>
      </li>)}</ol>
      {registrationReady && <div className={styles.launchActions}>
        <Link href={`/clubs/${encodeURIComponent(view.club.slug)}/register`}>Open team registration →</Link>
        <button type="button" onClick={()=>void navigator.clipboard.writeText(`${window.location.origin}/clubs/${view.club.slug}/register`)}>Copy registration link</button>
      </div>}
      {!registrationReady && <p className={styles.launchGate}>Team registration becomes available once you have an active season with at least one division.</p>}
    </section>
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
    <section className={styles.metrics} aria-label="Club totals">
      {([["Seasons", view.summaries.length], ["Divisions", totals.divisions],
        ["Teams", totals.teams], ["Fixtures", totals.fixtures],
        ["Confirmed results", totals.confirmed], ["Sponsors", view.sponsors]] as [string, number][])
        .map(([label, value]) => <article key={label}><span>{label}</span>
          <strong>{value.toLocaleString("en-GB")}</strong></article>)}
    </section>
    <ClubEditor
      club={view.club}
      seasons={view.summaries.map((summary): EditableSeason => ({
        id: summary.season.id, name: summary.season.name,
        club_id: summary.season.club_id, status: summary.season.status,
        divisions: summary.divisionSummaries,
      }))}
      onSaved={() => setRevision((value) => value + 1)}
      fixtures={view.fixtures}
    />
    <div className={styles.sectionHeading}><h2>Club seasons</h2>
      <p>Each season below belongs to {view.club.name}.</p></div>
    <section className={styles.grid}>
      {view.summaries.map(({ season, divisions, teams, fixtures, confirmed, divisionSummaries }) =>
        <article className={styles.card} key={season.id}>
          <span className={styles.status}>{season.status}</span>
          <h3>{season.name}</h3>
          <div className={styles.numbers}>
            <span><strong>{divisions}</strong> divisions</span>
            <span><strong>{teams}</strong> teams</span>
            <span><strong>{fixtures}</strong> fixtures</span>
            <span><strong>{confirmed}</strong> confirmed</span>
          </div>
          <div className={styles.divisionList}>
            <h4>Divisions &amp; teams</h4>
            {divisionSummaries.map((division) => <details key={division.id} className={styles.divisionRow}>
              <summary>{division.name}<span>{division.teams.length} teams</span></summary>
              {division.teams.length
                ? <ul>{division.teams.map((name, index) => <li key={`${division.id}-${index}`}>{name.name}</li>)}</ul>
                : <p>No teams yet.</p>}
            </details>)}
            {!divisionSummaries.length && <p>No divisions yet.</p>}
          </div>
          <a href={`/clubs/${encodeURIComponent(view.club.slug)}`}>View season in club hub →</a>
        </article>)}
      {!view.summaries.length && <article className={styles.card}>
        <h3>No seasons yet</h3><p>Club seasons will appear here when configured.</p>
      </article>}
    </section>
    <p className={styles.note}>All changes are restricted to this club by verified membership and database permissions.</p>
  </div></main>;
}
