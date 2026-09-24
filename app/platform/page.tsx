"use client";

import RalloraLogo from "@/app/components/rallora-logo";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import styles from "./platform.module.css";

type Club = { id: string; slug: string; name: string; is_active: boolean };
type Season = {
  id: string; club_id: string; name: string;
  status: "draft" | "active" | "completed";
};
type Subscription = { plan_code:string; status:string };
type Entitlement = { feature_key:string; is_enabled:boolean };
type ClubSummary = { club: Club; seasons: Season[]; teams: number; fixtures: number;
  members:number; players:number; subscription:Subscription|null; features:Entitlement[] };
type Application = { id:string; applicant_name:string|null; club_name:string; requested_slug:string; contact_email:string; plan_code:string; status:string; created_at:string };
type Readiness = Record<string,number>;
type View =
  | { status: "loading" | "signed_out" | "forbidden" }
  | { status: "error"; message: string }
  | { status: "ready"; clubs: ClubSummary[]; applications: Application[] };

export default function PlatformControlCentre() {
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<View>({ status: "loading" });
  const [busy,setBusy]=useState("");
  const [notice,setNotice]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [readiness,setReadiness]=useState<Readiness|null>(null);
  const load=useCallback(async()=>{
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError && authError.name !== "AuthSessionMissingError") throw authError;
        if (!user) {
          setView({ status: "signed_out" });
          return;
        }
        const { data: admin, error: adminError } = await supabase
          .from("rallora_platform_admins").select("user_id")
          .eq("user_id", user.id).maybeSingle();
        if (adminError) throw adminError;
        if (!admin) {
          setView({ status: "forbidden" });
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
            const [membershipCount,playerCount,subscriptionReply,featureReply]=await Promise.all([
              supabase.from("rallora_club_memberships").select("id",{count:"exact",head:true}).eq("club_id",club.id).eq("status","active"),
              supabase.from("rallora_team_roster_memberships").select("id",{count:"exact",head:true}).eq("club_id",club.id),
              supabase.from("rallora_club_subscriptions").select("plan_code,status").eq("club_id",club.id).maybeSingle(),
              supabase.from("rallora_club_feature_entitlements").select("feature_key,is_enabled").eq("club_id",club.id),
            ]);
            if(membershipCount.error||playerCount.error||subscriptionReply.error||featureReply.error) throw membershipCount.error||playerCount.error||subscriptionReply.error||featureReply.error;
            const common={club,seasons,members:membershipCount.count??0,players:playerCount.count??0,
              subscription:subscriptionReply.data as Subscription|null,features:(featureReply.data??[])as Entitlement[]};
            if (!seasons.length) return { ...common, teams: 0, fixtures: 0 };
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
              ...common,
              teams: teamCount.count ?? 0,
              fixtures: fixtureCount.count ?? 0,
            };
          }),
        );
        const applicationsReply = await supabase.from("rallora_club_applications")
          .select("id,applicant_name,club_name,requested_slug,contact_email,plan_code,status,created_at").order("created_at",{ascending:false});
        if (applicationsReply.error) throw applicationsReply.error;
        const readinessReply=await supabase.rpc("rallora_pilot_readiness_report");
        if(readinessReply.error) throw readinessReply.error;
        setReadiness((readinessReply.data??{}) as Readiness);
        setView({ status: "ready", clubs: summaries, applications: (applicationsReply.data ?? []) as Application[] });
      } catch (e) {
        setView({
          status: "error",
          message: e instanceof Error ? e.message : "Could not load clubs.",
        });
      }
  },[supabase]);
  useEffect(() => {
    void load();
    // Defer rechecking until outside the Supabase auth callback.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void load(); }, 0);
    });
    return () => {
      if (timer) clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [supabase,load]);

  async function action(key:string,request:PromiseLike<{error:Error|null}>,success:string){
    setBusy(key);setNotice("");const {error}=await request;if(error){setNotice(error.message);setBusy("");return;}
    setNotice(success);setBusy("");await load();
  }
  function approveApplication(id:string){return action(`application-${id}`,supabase.rpc("rallora_approve_club_application",{p_application_id:id}),"Club approved and activated.");}
  function declineApplication(id:string){return action(`application-${id}`,supabase.rpc("rallora_platform_decline_application",{p_application_id:id}),"Application declined.");}
  function setClubStatus(id:string,value:boolean){return action(`club-${id}`,supabase.rpc("rallora_platform_set_club_status",{p_club_id:id,p_is_active:value}),value?"Club activated.":"Club suspended.");}
  function setPlan(id:string,plan:string,status:string){return action(`plan-${id}`,supabase.rpc("rallora_platform_set_plan",{p_club_id:id,p_plan_code:plan,p_status:status}),"Subscription updated.");}
  function setFeature(id:string,feature:string,enabled:boolean){return action(`feature-${id}-${feature}`,supabase.rpc("rallora_platform_set_feature",{p_club_id:id,p_feature_key:feature,p_enabled:enabled}),"Feature access updated.");}
  async function signIn(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy("sign-in");setNotice("");const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error){setNotice(error.message);setBusy("");return}setPassword("");setBusy("");await load()}
  async function signOut(){setBusy("sign-out");await supabase.auth.signOut();setBusy("");setView({status:"signed_out"})}

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
      <Link href="/notifications">Notifications</Link>
      {view.status==="ready"&&<button className={styles.signOut} disabled={busy==="sign-out"} onClick={()=>void signOut()}>Sign out</button>}
      <span className={styles.badge}>PLATFORM ADMIN</span>
    </nav>
    <header className={styles.hero}>
      <small>ONE PLATFORM. EVERY CLUB.</small>
      <h1>Club operations, all in one place.</h1>
      <p>Platform oversight is separate from each club’s own league administration.</p>
    </header>
    {view.status === "loading" && <p className={styles.notice} role="status">Checking administrator access and loading clubs…</p>}
    {view.status === "signed_out" && <section className={styles.notice}>
      <h2>Rallora administrator sign in</h2><p>Use your Rallora platform account. Club organisers sign in through their own club dashboard.</p>
      <form className={styles.loginForm} onSubmit={signIn}><label>Email<input type="email" autoComplete="username" required value={email} onChange={event=>setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)} /></label><button disabled={busy==="sign-in"}>{busy==="sign-in"?"Signing in…":"Sign in to Rallora"}</button><Link href="/account">Forgot your password?</Link>{notice&&<p role="alert">{notice}</p>}</form>
    </section>}
    {view.status === "forbidden" && <section className={styles.notice} role="alert">
      <h2>Access denied</h2><p>This area is available only to Rallora platform administrators.</p><button className={styles.switchAccount} onClick={()=>void signOut()}>Sign out and use another account</button>
    </section>}
    {view.status === "error" && <section className={styles.notice} role="alert">
      <h2>Could not load the control centre</h2><p>{view.message}</p>
    </section>}
    {view.status === "ready" && <>
      {notice&&<p className={styles.notice} role="status">{notice}</p>}
      <section className={styles.metrics} aria-label="Platform summary">
        {([["Clubs", summaries.length], ["Active clubs", totals.activeClubs],
          ["Active seasons", totals.activeSeasons], ["Teams", totals.teams],
          ["Fixtures", totals.fixtures]] as [string, number][])
          .map(([label, count]) => <div className={styles.metric} key={label}>
            <span>{label}</span><strong>{count.toLocaleString("en-GB")}</strong>
          </div>)}
      </section>
      <h2>Pilot readiness</h2>{readiness&&<section className={styles.metrics} aria-label="Pilot readiness">{Object.entries(readiness).map(([key,value])=><div className={styles.metric} key={key}><span>{key.replaceAll("_"," ")}</span><strong>{Number(value).toLocaleString("en-GB")}</strong></div>)}</section>}<h2>Registered clubs</h2>
      <section className={styles.grid} aria-label="Registered clubs">
        {summaries.map(({ club, seasons, teams, fixtures, members, players, subscription, features }) =>
          <article className={styles.card} key={club.id}>
            <span className={styles.clubIcon}>{club.name.slice(0, 1).toUpperCase()}</span>
            <span className={styles.status}>{club.is_active ? "ACTIVE" : "INACTIVE"}</span>
            <h3>{club.name}</h3><p className={styles.slug}>/{club.slug}</p>
            <dl className={styles.clubMetrics}>
              <div><dt>Seasons</dt><dd>{seasons.length}</dd></div>
              <div><dt>Teams</dt><dd>{teams}</dd></div>
              <div><dt>Fixtures</dt><dd>{fixtures}</dd></div>
              <div><dt>Organisers</dt><dd>{members}</dd></div>
              <div><dt>Players</dt><dd>{players}</dd></div>
            </dl>
            <div className={styles.controls}>
              <label>Plan<select defaultValue={subscription?.plan_code??"starter"} id={`plan-${club.id}`}>
                <option value="starter">Starter</option><option value="league">League</option><option value="pro">Pro</option>
              </select></label>
              <label>Status<select defaultValue={subscription?.status??"trialing"} id={`status-${club.id}`}>
                <option value="trialing">Trial</option><option value="active">Active</option><option value="past_due">Past due</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option>
              </select></label>
              <button disabled={busy===`plan-${club.id}`} onClick={()=>{const plan=(document.getElementById(`plan-${club.id}`)as HTMLSelectElement).value;const status=(document.getElementById(`status-${club.id}`)as HTMLSelectElement).value;void setPlan(club.id,plan,status)}}>Save plan</button>
              <button disabled={busy===`club-${club.id}`} onClick={()=>void setClubStatus(club.id,!club.is_active)}>{club.is_active?"Suspend club":"Activate club"}</button>
            </div>
            <div className={styles.features}>{["core_league","player_registration","captain_results","social_studio","sponsors","reminders","club_events"].map(feature=><label key={feature}><input type="checkbox" checked={features.some(item=>item.feature_key===feature&&item.is_enabled)} onChange={event=>void setFeature(club.id,feature,event.target.checked)}/>{feature.replaceAll("_"," ")}</label>)}</div>
            <strong>Seasons</strong>
            {seasons.map(s => <div className={styles.season} key={s.id}>
              <span>{s.name}</span><em>{s.status}</em>
            </div>)}
            {!seasons.length && <p>No seasons created yet.</p>}
            <p><a href={`/clubs/${encodeURIComponent(club.slug)}`}>View this club’s league hub →</a></p>
            <p><a href={`/clubs/${encodeURIComponent(club.slug)}/admin`}>Open club administration →</a></p>
            {club.slug === "gsm-padel" && <p><Link href="/clubs/gsm-padel/legacy">Open legacy GSM management →</Link></p>}
          </article>)}
      </section>
      <h2>Club applications</h2>
      <section className={styles.grid} aria-label="Club applications">
        {view.applications.map(application => <article className={styles.card} key={application.id}>
          <span className={styles.status}>{application.status}</span>
          <h3>{application.club_name}</h3><p className={styles.slug}>/{application.requested_slug}</p>
          <p>{application.applicant_name&&<><strong>{application.applicant_name}</strong><br/></>}{application.contact_email}</p><p>Requested plan: <strong>{application.plan_code}</strong></p>
          {application.status === "pending" && <div className={styles.actionRow}><button disabled={busy===`application-${application.id}`} onClick={() => void approveApplication(application.id)}>Approve & activate</button><button className={styles.secondary} disabled={busy===`application-${application.id}`} onClick={() => void declineApplication(application.id)}>Decline</button></div>}
        </article>)}
        {!view.applications.length && <article className={styles.card}><h3>No club applications</h3><p>New applications appear here for approval.</p></article>}
      </section>
      <p className={styles.footnote}>Plan state is ready for a payment provider to be connected later; no automatic charges are taken.</p>
    </>}
  </div></main>;
}
