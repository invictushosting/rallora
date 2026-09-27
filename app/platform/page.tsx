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
type Application = { id:string; applicant_name:string|null; club_name:string; requested_slug:string; contact_email:string; contact_phone:string|null; plan_code:string; status:string; created_at:string };
type PilotEnquiry = { id:string; club_name:string; contact_name:string; contact_email:string; contact_phone:string|null; club_location:string; court_count:number|null; enquiry_type:string; message:string|null; status:string; source:string; assignee:string|null; internal_notes:string|null; next_follow_up_at:string|null; last_contacted_at:string|null; lost_reason:string|null; linked_club_id:string|null; created_at:string; updated_at:string };
type Readiness = Record<string,number>;
type SupportRequest = { id:string; club_id:string|null; requester_name:string|null; requester_email:string; category:string; subject:string; message:string; priority:string; status:string; assignee:string|null; internal_notes:string|null; created_at:string };
type FormatRequest = {
  id:string; club_id:string; format_name:string; description:string; team_structure:string|null;
  group_structure:string|null; match_structure:string|null; scheduling_rules:string|null;
  scoring_rules:string|null; promotion_relegation_rules:string|null; special_rules:string|null;
  reference_link:string|null; status:string; implemented_format_key:string|null;
  platform_notes:string|null; created_at:string;
};
type View =
  | { status: "loading" | "signed_out" | "forbidden" }
  | { status: "error"; message: string }
  | { status: "ready"; clubs: ClubSummary[]; applications: Application[]; pilotEnquiries: PilotEnquiry[]; formatRequests: FormatRequest[]; supportRequests: SupportRequest[] };

export default function PlatformControlCentre() {
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<View>({ status: "loading" });
  const [busy,setBusy]=useState("");
  const [showNotifications,setShowNotifications]=useState(false);
  const [notice,setNotice]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [readiness,setReadiness]=useState<Readiness|null>(null);
  const [showAddClub,setShowAddClub]=useState(false);
  const [supportFilter,setSupportFilter]=useState("open");
  const [supportCategory,setSupportCategory]=useState("all");
  const [crmFilter,setCrmFilter]=useState("active");
  const [crmSearch,setCrmSearch]=useState("");
  const [crmActivityFeedback,setCrmActivityFeedback]=useState<Record<string,string>>({});
  const [crmSaveFeedback,setCrmSaveFeedback]=useState<Record<string,string>>({});
  const [crmSelected,setCrmSelected]=useState<string|null>(null);
  const [crmActivities,setCrmActivities]=useState<Record<string,{id:string;activity_type:string;detail:string|null;created_at:string}[]>>({});
  const [supportSelected,setSupportSelected]=useState<string|null>(null);
  const [notificationReads,setNotificationReads]=useState<Set<string>>(new Set());
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
        const [applicationsReply,pilotEnquiriesReply,formatRequestsReply,supportRequestsReply,notificationReadsReply] = await Promise.all([
          supabase.from("rallora_club_applications")
            .select("id,applicant_name,club_name,requested_slug,contact_email,contact_phone,plan_code,status,created_at")
            .order("created_at",{ascending:false}),
          supabase.from("rallora_pilot_enquiries").select("id,club_name,contact_name,contact_email,contact_phone,club_location,court_count,enquiry_type,message,status,source,assignee,internal_notes,next_follow_up_at,last_contacted_at,lost_reason,linked_club_id,created_at,updated_at").order("created_at",{ascending:false}),
          supabase.from("rallora_format_requests")
            .select("id,club_id,format_name,description,team_structure,group_structure,match_structure,scheduling_rules,scoring_rules,promotion_relegation_rules,special_rules,reference_link,status,implemented_format_key,platform_notes,created_at")
            .order("created_at",{ascending:false}),
          supabase.from("rallora_support_requests").select("id,club_id,requester_name,requester_email,category,subject,message,priority,status,assignee,internal_notes,created_at").order("created_at",{ascending:false}),
          supabase.from("rallora_platform_notification_reads").select("notification_type,notification_id"),
        ]);
        if (applicationsReply.error) throw applicationsReply.error;
        if (pilotEnquiriesReply.error) throw pilotEnquiriesReply.error;
        if (formatRequestsReply.error) throw formatRequestsReply.error;
        if (supportRequestsReply.error) throw supportRequestsReply.error;
        if (notificationReadsReply.error) throw notificationReadsReply.error;
        setNotificationReads(new Set((notificationReadsReply.data??[]).map(row=>`${row.notification_type}:${row.notification_id}`)));
        const readinessReply=await supabase.rpc("rallora_pilot_readiness_report");
        if(readinessReply.error) throw readinessReply.error;
        setReadiness((readinessReply.data??{}) as Readiness);
        setView({
          status: "ready",
          clubs: summaries,
          applications: (applicationsReply.data ?? []) as Application[],
          pilotEnquiries: (pilotEnquiriesReply.data ?? []) as PilotEnquiry[],
          formatRequests: (formatRequestsReply.data ?? []) as FormatRequest[],
          supportRequests: (supportRequestsReply.data ?? []) as SupportRequest[],
        });
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
  async function updatePilotEnquiry(id:string,status:string){const current=view.status==="ready"?view.pilotEnquiries.find(item=>item.id===id):null;const updates:Record<string,string|null>={status,updated_at:new Date().toISOString()};if(status==="contacted")updates.last_contacted_at=new Date().toISOString();await action(`pilot-${id}`,supabase.from("rallora_pilot_enquiries").update(updates).eq("id",id),"CRM stage updated.");const {data:{user}}=await supabase.auth.getUser();await supabase.from("rallora_enquiry_activities").insert({enquiry_id:id,user_id:user?.id??null,activity_type:status==="won"?"won":status==="lost"?"lost":"status_change",detail:`${current?.status??"unknown"} → ${status}`});}
  async function saveCrmLead(id:string){const assignee=(document.getElementById(`crm-assignee-${id}`) as HTMLInputElement)?.value.trim()||null;const follow=(document.getElementById(`crm-follow-${id}`) as HTMLInputElement)?.value||null;setCrmSaveFeedback(current=>({...current,[id]:"Saving…"}));const {error}=await supabase.from("rallora_pilot_enquiries").update({assignee,next_follow_up_at:follow?new Date(follow).toISOString():null,updated_at:new Date().toISOString()}).eq("id",id);if(error){setCrmSaveFeedback(current=>({...current,[id]:error.message}));return}setCrmSaveFeedback(current=>({...current,[id]:"Lead saved ✓"}));await load();}
  async function completeCrmFollowUp(id:string){const lead=view.status==="ready"?view.pilotEnquiries.find(item=>item.id===id):null;if(!lead?.next_follow_up_at)return;const when=new Date(lead.next_follow_up_at).toLocaleString("en-GB");const {error}=await supabase.from("rallora_pilot_enquiries").update({next_follow_up_at:null,updated_at:new Date().toISOString()}).eq("id",id);if(error){setCrmSaveFeedback(current=>({...current,[id]:error.message}));return}const {data:{user}}=await supabase.auth.getUser();await supabase.from("rallora_enquiry_activities").insert({enquiry_id:id,user_id:user?.id??null,activity_type:"follow_up",detail:`Follow-up completed (${when})`});setCrmSaveFeedback(current=>({...current,[id]:"Follow-up completed ✓"}));await load();await loadCrmActivities(id);}
  async function addCrmNote(id:string){const input=document.getElementById(`crm-activity-${id}`) as HTMLInputElement;const detail=input?.value.trim();if(!detail){setCrmActivityFeedback(current=>({...current,[id]:"Enter an activity or note first."}));return}setBusy(`crm-activity-${id}`);setCrmActivityFeedback(current=>({...current,[id]:"Saving…"}));const {data:{user}}=await supabase.auth.getUser();const {error}=await supabase.from("rallora_enquiry_activities").insert({enquiry_id:id,user_id:user?.id??null,activity_type:"note",detail});setBusy("");if(error){setCrmActivityFeedback(current=>({...current,[id]:error.message}));return}input.value="";await loadCrmActivities(id);setCrmActivityFeedback(current=>({...current,[id]:"Activity saved ✓"}));}
  async function loadCrmActivities(id:string){const {data,error}=await supabase.from("rallora_enquiry_activities").select("id,activity_type,detail,created_at").eq("enquiry_id",id).order("created_at",{ascending:false}).limit(20);if(error){setCrmActivityFeedback(current=>({...current,[id]:error.message}));return}setCrmActivities(current=>({...current,[id]:data??[]}));}
  function openCrmLead(id:string){const next=crmSelected===id?null:id;setCrmSelected(next);if(next)void loadCrmActivities(id);}
  async function setNotificationRead(type:string,id:string,read:boolean){const {data:{user}}=await supabase.auth.getUser();if(!user)return;const key=`${type}:${id}`;setNotificationReads(current=>{const next=new Set(current);read?next.add(key):next.delete(key);return next;});const request=read?supabase.from("rallora_platform_notification_reads").upsert({user_id:user.id,notification_type:type,notification_id:id,read_at:new Date().toISOString()}):supabase.from("rallora_platform_notification_reads").delete().eq("user_id",user.id).eq("notification_type",type).eq("notification_id",id);const {error}=await request;if(error){setNotice(error.message);await load();}}
  function declineApplication(id:string){return action(`application-${id}`,supabase.rpc("rallora_platform_decline_application",{p_application_id:id}),"Application declined.");}
  function setClubStatus(id:string,value:boolean){return action(`club-${id}`,supabase.rpc("rallora_platform_set_club_status",{p_club_id:id,p_is_active:value}),value?"Club activated.":"Club suspended.");}
  function setPlan(id:string,plan:string,status:string){return action(`plan-${id}`,supabase.rpc("rallora_platform_set_plan",{p_club_id:id,p_plan_code:plan,p_status:status}),"Subscription updated.");}
  function setFeature(id:string,feature:string,enabled:boolean){return action(`feature-${id}-${feature}`,supabase.rpc("rallora_platform_set_feature",{p_club_id:id,p_feature_key:feature,p_enabled:enabled}),"Feature access updated.");}
  function updateSupportRequest(id:string,status:string){return action(`support-${id}`,supabase.from("rallora_support_requests").update({status,updated_at:new Date().toISOString()}).eq("id",id),"Support request updated.");}
  function saveSupportDetails(id:string){const priority=(document.getElementById(`support-priority-${id}`) as HTMLSelectElement)?.value;const assignee=(document.getElementById(`support-assignee-${id}`) as HTMLInputElement)?.value.trim()||null;const internal_notes=(document.getElementById(`support-notes-${id}`) as HTMLTextAreaElement)?.value.trim()||null;return action(`support-${id}`,supabase.from("rallora_support_requests").update({priority,assignee,internal_notes,updated_at:new Date().toISOString()}).eq("id",id),"Support request saved.");}
  function updateFormatRequest(id:string){
    const status=(document.getElementById(`format-status-${id}`) as HTMLSelectElement)?.value||"reviewing";
    const notes=(document.getElementById(`format-notes-${id}`) as HTMLTextAreaElement)?.value.trim()||null;
    const key=(document.getElementById(`format-key-${id}`) as HTMLInputElement)?.value.trim()||null;
    return action(`format-${id}`,supabase.from("rallora_format_requests").update({
      status,platform_notes:notes,implemented_format_key:key,updated_at:new Date().toISOString(),
    }).eq("id",id),"Format request updated.");
  }
  async function createClub(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy("create-club");setNotice("");
    const form=new FormData(event.currentTarget);
    const response=await fetch("/api/platform/clubs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      name:String(form.get("name")).trim(),
      slug:String(form.get("slug")).trim().toLowerCase(),
      ownerEmail:String(form.get("ownerEmail")).trim().toLowerCase(),
      ownerPassword:String(form.get("ownerPassword")||""),
      plan:String(form.get("plan")),
      contactName:String(form.get("contactName")).trim(),
      contactPhone:String(form.get("contactPhone")).trim(),
      address1:String(form.get("address1")).trim(),
      town:String(form.get("town")).trim(),
      postcode:String(form.get("postcode")).trim(),
      country:String(form.get("country")).trim(),
    })});
    const body=await response.json().catch(()=>({})) as {error?:string;ownerCreated?:boolean};
    if(!response.ok){setNotice(body.error||"Could not create the club.");setBusy("");return}
    setNotice(body.ownerCreated?"Club and owner account created. Share the temporary login details with the owner.":"Club created and linked to the existing owner account.");
    setBusy("");setShowAddClub(false);await load();
  }
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
      <Link className={styles.brand} href="/" aria-label="Rallora home"><RalloraLogo variant="light" width={184}/></Link>
      <div className={styles.navTitle}><strong>Platform Control Centre</strong><span>Rallora operations</span></div>
      <div className={styles.navActions}>
        {view.status==="ready"?<div style={{position:"relative"}}><button type="button" onClick={()=>setShowNotifications(value=>!value)} aria-expanded={showNotifications} style={{border:0,background:"transparent",cursor:"pointer",font:"inherit",color:"inherit"}}>Notifications{(()=>{const count=view.pilotEnquiries.filter(item=>item.status==="new"&&!notificationReads.has(`pilot_enquiry:${item.id}`)).length+view.supportRequests.filter(item=>item.status==="new"&&!notificationReads.has(`support_request:${item.id}`)).length+view.applications.filter(item=>item.status==="pending"&&!notificationReads.has(`club_application:${item.id}`)).length;return count>0?<strong style={{marginLeft:6,display:"inline-flex",minWidth:20,height:20,padding:"0 6px",alignItems:"center",justifyContent:"center",borderRadius:999,background:"#00B0FE",color:"#061A39",fontSize:11}}>{count}</strong>:null})()}</button>{showNotifications&&<div style={{position:"absolute",right:0,top:"calc(100% + 12px)",zIndex:20,width:340,maxWidth:"80vw",maxHeight:"min(440px,70vh)",overflowY:"auto",padding:16,borderRadius:16,background:"#fff",boxShadow:"0 18px 50px rgba(6,26,57,.18)",border:"1px solid #dce9f2",color:"#061A39"}}><strong>Needs your attention</strong><p style={{margin:"6px 0 14px",fontSize:12,color:"#65758b"}}>New Rallora platform activity. Mark items read when reviewed.</p>{view.pilotEnquiries.filter(item=>item.status==="new").slice(0,8).map(item=>{const read=notificationReads.has(`pilot_enquiry:${item.id}`);return <div key={item.id} style={{padding:"10px 0",borderTop:"1px solid #edf3f7",opacity:read?.58:1}}><a href="#platform-inbox" onClick={()=>setShowNotifications(false)} style={{display:"block"}}><b>New pilot enquiry</b><br/><span style={{fontSize:12}}>{item.club_name} · {item.contact_name}</span></a><button type="button" onClick={()=>void setNotificationRead("pilot_enquiry",item.id,!read)} style={{marginTop:6,border:0,background:"transparent",padding:0,cursor:"pointer",fontSize:11,color:"#006da8"}}>{read?"Mark unread":"Mark as read"}</button></div>})}{view.supportRequests.filter(item=>item.status==="new").slice(0,8).map(item=>{const read=notificationReads.has(`support_request:${item.id}`);return <div key={item.id} style={{padding:"10px 0",borderTop:"1px solid #edf3f7",opacity:read?.58:1}}><a href="#support-inbox" onClick={()=>setShowNotifications(false)} style={{display:"block"}}><b>New support request</b><br/><span style={{fontSize:12}}>{item.subject}</span></a><button type="button" onClick={()=>void setNotificationRead("support_request",item.id,!read)} style={{marginTop:6,border:0,background:"transparent",padding:0,cursor:"pointer",fontSize:11,color:"#006da8"}}>{read?"Mark unread":"Mark as read"}</button></div>})}{view.applications.filter(item=>item.status==="pending").slice(0,8).map(item=>{const read=notificationReads.has(`club_application:${item.id}`);return <div key={item.id} style={{padding:"10px 0",borderTop:"1px solid #edf3f7",opacity:read?.58:1}}><a href="#club-applications" onClick={()=>setShowNotifications(false)} style={{display:"block"}}><b>Club application</b><br/><span style={{fontSize:12}}>{item.club_name}</span></a><button type="button" onClick={()=>void setNotificationRead("club_application",item.id,!read)} style={{marginTop:6,border:0,background:"transparent",padding:0,cursor:"pointer",fontSize:11,color:"#006da8"}}>{read?"Mark unread":"Mark as read"}</button></div>})}{!(view.pilotEnquiries.some(item=>item.status==="new")||view.supportRequests.some(item=>item.status==="new")||view.applications.some(item=>item.status==="pending"))&&<p style={{margin:0}}>You're all caught up.</p>}</div>}</div>:<span>Notifications</span>}
        <Link href="/account">Security</Link>
        {view.status==="ready"&&<button className={styles.signOut} disabled={busy==="sign-out"} onClick={()=>void signOut()}>Sign out</button>}
      </div>
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
      <div className={styles.sectionHeading}><div><small>CLUB OPERATIONS</small><h2>Clubs</h2></div><div className={styles.sectionActions}><p>Manage access, plans and features across Rallora.</p><button type="button" onClick={()=>setShowAddClub(value=>!value)}>{showAddClub?"Cancel":"＋ Add club"}</button></div></div>
      {showAddClub&&<form className={styles.addClubForm} onSubmit={createClub}>
        <div><span>MANUAL ONBOARDING</span><h3>Add a club</h3><p>Use this when Rallora is onboarding a club directly. If the owner does not have a Rallora account yet, one will be created at the same time.</p></div>
        <label>Club name<input name="name" required minLength={2} maxLength={120} placeholder="Example Padel Club"/></label>
        <label>Club web address<div className={styles.slugInput}><span>rallora.app/clubs/</span><input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="example-padel"/></div></label>
        <label>Owner email<input name="ownerEmail" type="email" required placeholder="owner@example.com"/></label><label>Temporary password<span className={styles.fieldHint}>Only used if this owner does not already have a Rallora account.</span><input name="ownerPassword" type="password" minLength={8} autoComplete="new-password" placeholder="Minimum 8 characters"/></label>
        <label>Primary contact name<input name="contactName" required minLength={2} placeholder="Club owner / manager"/></label>
        <label>Mobile number<input name="contactPhone" type="tel" autoComplete="tel" required minLength={7} placeholder="+44 7..."/></label>
        <label>Address line 1<input name="address1" required minLength={3} placeholder="Venue address"/></label>
        <label>Town / city<input name="town" required minLength={2} placeholder="Manchester"/></label>
        <label>Postcode<input name="postcode" required minLength={2} placeholder="M1 1AA"/></label>
        <label>Country<input name="country" required defaultValue="United Kingdom"/></label>
        <label>Plan<select name="plan" defaultValue="league"><option value="starter">Starter</option><option value="league">Growth</option><option value="pro">Pro</option></select></label>
        <button disabled={busy==="create-club"}>{busy==="create-club"?"Creating club…":"Create club & activate owner"}</button>
      </form>}
      <section className={styles.grid} aria-label="Registered clubs">
        {summaries.map(({ club, seasons, teams, fixtures, members, players, subscription, features }) =>
          <article className={styles.card} key={club.id}>
            <span className={styles.clubIcon}>{club.name.slice(0, 1).toUpperCase()}</span>
            <span className={styles.status}>{club.is_active ? "ACTIVE" : "INACTIVE"}</span>
            <h3>{club.name}</h3><p className={styles.slug}>/{club.slug}</p>
            <dl className={styles.clubMetrics}>
              <div><dt>Seasons</dt><dd>{seasons.length}</dd></div><div><dt>Teams</dt><dd>{teams}</dd></div><div><dt>Fixtures</dt><dd>{fixtures}</dd></div><div><dt>Organisers</dt><dd>{members}</dd></div><div><dt>Players</dt><dd>{players}</dd></div>
            </dl>
            <div className={styles.controls}>
              <label>Plan<select defaultValue={subscription?.plan_code??"starter"} id={`plan-${club.id}`}><option value="starter">Starter</option><option value="league">Growth</option><option value="pro">Pro</option></select></label>
              <label>Status<select defaultValue={subscription?.status??"trialing"} id={`status-${club.id}`}><option value="trialing">Trial</option><option value="active">Active</option><option value="past_due">Past due</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option></select></label>
              <button disabled={busy===`plan-${club.id}`} onClick={()=>{const plan=(document.getElementById(`plan-${club.id}`)as HTMLSelectElement).value;const status=(document.getElementById(`status-${club.id}`)as HTMLSelectElement).value;void setPlan(club.id,plan,status)}}>Save plan</button>
              <button disabled={busy===`club-${club.id}`} onClick={()=>{const next=!club.is_active;if(window.confirm(`${next?"Activate":"Suspend"} ${club.name}?`))void setClubStatus(club.id,next)}}>{club.is_active?"Suspend club":"Activate club"}</button>
            </div>
            <div className={styles.features}>{["core_league","player_registration","captain_results","social_studio","sponsors","reminders","club_events"].map(feature=><label key={feature}><input type="checkbox" checked={features.some(item=>item.feature_key===feature&&item.is_enabled)} onChange={event=>void setFeature(club.id,feature,event.target.checked)}/>{feature.replaceAll("_"," ")}</label>)}</div>
            <strong>Seasons</strong>
            {seasons.map(s => <div className={styles.season} key={s.id}><span>{s.name}</span><em>{s.status}</em></div>)}
            {!seasons.length && <p>No seasons created yet.</p>}
            <div className={styles.clubActions}><a href={`/clubs/${encodeURIComponent(club.slug)}/admin`}>Open club admin</a><a href={`/clubs/${encodeURIComponent(club.slug)}`}>View public hub</a></div>
          </article>)}
        {!summaries.length&&<article className={styles.card}><h3>No clubs yet</h3><p>Add a club manually or approve an application below.</p></article>}
      </section>
      <div className={styles.sectionHeading}><div><small>SUPPORT & REQUESTS</small><h2>Support dashboard</h2></div><p>One operational inbox for bugs, help, registration and customer requests.</p></div>
      <section className={styles.metrics} aria-label="Support summary">
        {([["New",view.supportRequests.filter(r=>r.status==="new").length],["Open",view.supportRequests.filter(r=>["new","in_progress"].includes(r.status)).length],["Urgent",view.supportRequests.filter(r=>r.priority==="urgent"&&!["resolved","closed"].includes(r.status)).length],["Waiting",view.supportRequests.filter(r=>r.status==="waiting").length]] as [string,number][]).map(([label,count])=><div className={styles.metric} key={label}><span>{label}</span><strong>{count}</strong></div>)}
      </section>
      <div className={styles.supportToolbar}>
        <div>{["open","new","waiting","resolved","all"].map(filter=><button key={filter} className={supportFilter===filter?styles.filterActive:""} onClick={()=>setSupportFilter(filter)}>{filter==="waiting"?"Waiting":filter.charAt(0).toUpperCase()+filter.slice(1)}</button>)}</div>
        <select value={supportCategory} onChange={e=>setSupportCategory(e.target.value)} aria-label="Filter support category"><option value="all">All categories</option><option value="bug">Bugs</option><option value="general_help">General help</option><option value="registration">Registration</option><option value="billing">Billing</option><option value="feature_request">Feature requests</option><option value="other">Other</option></select>
      </div>
      <section className={styles.supportList} aria-label="Support requests">
        {view.supportRequests.filter(r=>(supportCategory==="all"||r.category===supportCategory)&&(supportFilter==="all"||(supportFilter==="open"?["new","in_progress"].includes(r.status):r.status===supportFilter))).map(request=><article className={`${styles.supportTicket} ${request.priority==="urgent"?styles.ticketUrgent:""}`} key={request.id}>
          <button className={styles.ticketSummary} onClick={()=>setSupportSelected(supportSelected===request.id?null:request.id)}>
            <span className={`${styles.priorityDot} ${styles[`priority_${request.priority}`]}`} aria-hidden="true"/><span><strong>{request.subject}</strong><small>{request.category.replaceAll("_"," ")} · {summaries.find(item=>item.club.id===request.club_id)?.club.name||request.requester_email}</small></span><em>{request.status.replaceAll("_"," ")}</em><time>{new Date(request.created_at).toLocaleDateString("en-GB")}</time>
          </button>
          {supportSelected===request.id&&<div className={styles.ticketDetail}>
            <div><h3>{request.subject}</h3><p>{request.message}</p><dl className={styles.applicationDetails}><div><dt>Requester</dt><dd>{request.requester_name||"Not supplied"}</dd></div><div><dt>Email</dt><dd><a href={`mailto:${request.requester_email}`}>{request.requester_email}</a></dd></div><div><dt>Club</dt><dd>{summaries.find(item=>item.club.id===request.club_id)?.club.name||"Platform / not linked"}</dd></div><div><dt>Received</dt><dd>{new Date(request.created_at).toLocaleString("en-GB")}</dd></div></dl></div>
            <div className={styles.ticketControls}>
              <label>Status<select value={request.status} onChange={e=>void updateSupportRequest(request.id,e.target.value)} disabled={busy===`support-${request.id}`}><option value="new">New</option><option value="in_progress">In progress</option><option value="waiting">Waiting on customer</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label>
              <label>Priority<select id={`support-priority-${request.id}`} defaultValue={request.priority}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
              <label>Assigned to<input id={`support-assignee-${request.id}`} defaultValue={request.assignee??""} placeholder="Team member"/></label>
              <label>Internal notes<textarea id={`support-notes-${request.id}`} defaultValue={request.internal_notes??""} rows={4} placeholder="Private notes for the Rallora team."/></label>
              <button disabled={busy===`support-${request.id}`} onClick={()=>void saveSupportDetails(request.id)}>{busy===`support-${request.id}`?"Saving…":"Save ticket"}</button>
            </div>
          </div>}
        </article>)}
        {!view.supportRequests.length&&<article className={styles.card}><h3>Support inbox clear</h3><p>Bug reports, general help and registration support requests will appear here.</p></article>}
      </section>
      <div id="platform-inbox" className={styles.sectionHeading}><div><small>ENQUIRIES / CRM</small><h2>Club pipeline</h2></div><p>Manage club leads from first enquiry through to onboarding.</p></div>
      <div className={styles.supportToolbar}><label>Pipeline<select value={crmFilter} onChange={e=>setCrmFilter(e.target.value)}><option value="active">Active pipeline</option><option value="new">New</option><option value="contacted">Contacted</option><option value="meeting">Meeting booked</option><option value="nurture">Nurture</option><option value="qualified">Qualified</option><option value="won">Won</option><option value="lost">Lost</option><option value="all">All leads</option></select></label><label>Search<input value={crmSearch} onChange={e=>setCrmSearch(e.target.value)} placeholder="Club, contact, email or location"/></label></div>
      <section className={styles.crmList} aria-label="Enquiry CRM">
        {view.pilotEnquiries.filter(enquiry=>{const active=!["won","lost","closed"].includes(enquiry.status);const statusOk=crmFilter==="all"||(crmFilter==="active"?active:enquiry.status===crmFilter);const q=crmSearch.trim().toLowerCase();return statusOk&&(!q||[enquiry.club_name,enquiry.contact_name,enquiry.contact_email,enquiry.club_location].some(value=>value.toLowerCase().includes(q)))}).map(enquiry=><article className={styles.crmLead} key={enquiry.id}>
          <button type="button" className={styles.crmSummary} onClick={()=>openCrmLead(enquiry.id)} aria-expanded={crmSelected===enquiry.id}><span><strong>{enquiry.club_name}</strong><small>{enquiry.contact_name} · {enquiry.club_location} · {enquiry.enquiry_type==="pilot"?"Pilot":"Information"}</small></span><span className={styles.crmMeta}>{enquiry.assignee||"Unassigned"}</span><span className={styles.crmMeta}>{enquiry.next_follow_up_at?`Follow-up ${new Date(enquiry.next_follow_up_at).toLocaleDateString("en-GB")}`:"No follow-up"}</span><em>{enquiry.status.replace("_"," ")}</em></button>
          {crmSelected===enquiry.id&&<div className={styles.crmDetail}><div className={styles.crmMain}><dl className={styles.applicationDetails}><div><dt>Email</dt><dd><a href={`mailto:${enquiry.contact_email}`}>{enquiry.contact_email}</a></dd></div><div><dt>Phone</dt><dd>{enquiry.contact_phone?<a href={`tel:${enquiry.contact_phone}`}>{enquiry.contact_phone}</a>:"Not supplied"}</dd></div><div><dt>Courts</dt><dd>{enquiry.court_count??"Not supplied"}</dd></div><div><dt>Received</dt><dd>{new Date(enquiry.created_at).toLocaleString("en-GB")}</dd></div></dl>{enquiry.message&&<p><strong>Original enquiry</strong><br/>{enquiry.message}</p>}<div className={styles.crmQuickActions}><a href={`mailto:${enquiry.contact_email}`}>Email contact</a>{enquiry.contact_phone&&<a href={`tel:${enquiry.contact_phone}`}>Call contact</a>}</div><div className={styles.crmActivity}><h4>Activity</h4><div className={styles.crmActivityEntry}><input id={`crm-activity-${enquiry.id}`} placeholder="Add a call, meeting or note…"/><button disabled={busy===`crm-activity-${enquiry.id}`} onClick={()=>void addCrmNote(enquiry.id)}>{busy===`crm-activity-${enquiry.id}`?"Saving…":"Add"}</button></div>{crmActivityFeedback[enquiry.id]&&<small role="status">{crmActivityFeedback[enquiry.id]}</small>}<div className={styles.crmTimeline}>{(crmActivities[enquiry.id]??[]).map(activity=><div key={activity.id}><span>{activity.activity_type.replace("_"," ")}</span><p>{activity.detail||"Activity recorded"}</p><time>{new Date(activity.created_at).toLocaleString("en-GB")}</time></div>)}{crmActivities[enquiry.id]&&!crmActivities[enquiry.id].length&&<p className={styles.crmEmpty}>No activity yet.</p>}</div></div></div><div className={styles.crmControls}><label>Stage<select value={enquiry.status} onChange={event=>void updatePilotEnquiry(enquiry.id,event.target.value)}><option value="new">New</option><option value="contacted">Contacted</option><option value="meeting">Meeting booked</option><option value="nurture">Nurture</option><option value="qualified">Qualified</option><option value="won">Won</option><option value="lost">Lost</option></select></label><label>Owner<input id={`crm-assignee-${enquiry.id}`} defaultValue={enquiry.assignee??""} placeholder="Unassigned"/></label><div className={styles.crmNextAction}><strong>Next action</strong>{enquiry.next_follow_up_at?<><span>Follow up with club</span><time>{new Date(enquiry.next_follow_up_at).toLocaleString("en-GB")}</time><button type="button" className={styles.secondary} onClick={()=>void completeCrmFollowUp(enquiry.id)}>Mark complete</button></>:<span>No follow-up scheduled</span>}</div><label>{enquiry.next_follow_up_at?"Reschedule follow-up":"Schedule follow-up"}<input id={`crm-follow-${enquiry.id}`} type="datetime-local" defaultValue={enquiry.next_follow_up_at?new Date(enquiry.next_follow_up_at).toISOString().slice(0,16):""}/></label><button disabled={crmSaveFeedback[enquiry.id]==="Saving…"} onClick={()=>void saveCrmLead(enquiry.id)}>{crmSaveFeedback[enquiry.id]==="Saving…"?"Saving…":"Save changes"}</button>{crmSaveFeedback[enquiry.id]&&<small role="status" style={{color:"#0878ad",fontWeight:800}}>{crmSaveFeedback[enquiry.id]}</small>}{enquiry.status==="qualified"&&<button onClick={()=>{setShowAddClub(true);setNotice(`Qualified lead: ${enquiry.club_name}. Use Add club below to complete onboarding.`)}}>Convert to club</button>}</div></div>}
        </article>)}
        {!view.pilotEnquiries.length&&<article className={styles.card}><h3>No enquiries yet</h3><p>Website and manually-added club leads will appear here.</p></article>}
      </section>
      <div className={styles.sectionHeading}><div><small>ONBOARDING</small><h2>Club applications</h2></div><p>Review clubs that applied through Rallora.</p></div>
      <section className={styles.grid} aria-label="Club applications">
        {view.applications.map(application => <article className={styles.card} key={application.id}>
          <span className={styles.status}>{application.status}</span>
          <h3>{application.club_name}</h3><p className={styles.slug}>rallora.app/clubs/{application.requested_slug}</p><dl className={styles.applicationDetails}><div><dt>Main contact</dt><dd>{application.applicant_name||"Not supplied"}</dd></div><div><dt>Email</dt><dd>{application.contact_email}</dd></div><div><dt>Mobile</dt><dd>{application.contact_phone||"Not supplied"}</dd></div><div><dt>Requested plan</dt><dd>{application.plan_code==="league"?"Growth":application.plan_code.charAt(0).toUpperCase()+application.plan_code.slice(1)}</dd></div><div><dt>Applied</dt><dd>{new Date(application.created_at).toLocaleDateString("en-GB")}</dd></div></dl>
          {application.status === "pending" && <div className={styles.actionRow}><button disabled={busy===`application-${application.id}`} onClick={() => {if(window.confirm(`Approve ${application.club_name} and activate its Rallora club?`))void approveApplication(application.id)}}>Approve & activate</button><button className={styles.secondary} disabled={busy===`application-${application.id}`} onClick={() => {if(window.confirm(`Decline the application from ${application.club_name}?`))void declineApplication(application.id)}}>Decline</button></div>}
        </article>)}
        {!view.applications.length && <article className={styles.card}><h3>No club applications</h3><p>New applications appear here for approval.</p></article>}
      </section>
      <div className={styles.sectionHeading}><div><small>PRODUCT REQUESTS</small><h2>League format requests</h2></div><p>Review formats requested by clubs and track them through delivery.</p></div>
      <section className={styles.grid} aria-label="League format requests">
        {view.formatRequests.map(request=>{
          const club=summaries.find(item=>item.club.id===request.club_id)?.club;
          return <article className={styles.card} key={request.id}>
            <span className={styles.status}>{request.status}</span>
            <h3>{request.format_name}</h3>
            <p className={styles.slug}>{club?.name??"Unknown club"} · {new Date(request.created_at).toLocaleDateString("en-GB")}</p>
            <p>{request.description}</p>
            <dl className={styles.applicationDetails}>
              {request.team_structure&&<div><dt>Teams / players</dt><dd>{request.team_structure}</dd></div>}
              {request.group_structure&&<div><dt>Groups / divisions</dt><dd>{request.group_structure}</dd></div>}
              {request.match_structure&&<div><dt>Matches</dt><dd>{request.match_structure}</dd></div>}
              {request.scheduling_rules&&<div><dt>Scheduling</dt><dd>{request.scheduling_rules}</dd></div>}
              {request.scoring_rules&&<div><dt>Scoring</dt><dd>{request.scoring_rules}</dd></div>}
              {request.promotion_relegation_rules&&<div><dt>Promotion / relegation</dt><dd>{request.promotion_relegation_rules}</dd></div>}
              {request.special_rules&&<div><dt>Special rules</dt><dd>{request.special_rules}</dd></div>}
            </dl>
            {request.reference_link&&<a href={request.reference_link} target="_blank" rel="noreferrer">Open reference ↗</a>}
            <div className={styles.controls}>
              <label>Status<select id={`format-status-${request.id}`} defaultValue={request.status}>
                <option value="new">New</option><option value="reviewing">Reviewing</option>
                <option value="building">Building</option><option value="testing">Testing</option>
                <option value="available">Available</option><option value="declined">Declined</option>
              </select></label>
              <label>Implemented format key<input id={`format-key-${request.id}`} defaultValue={request.implemented_format_key??""} placeholder="e.g. rolling-4-team" /></label>
              <label>Club-visible note<textarea id={`format-notes-${request.id}`} defaultValue={request.platform_notes??""} rows={4} placeholder="Update the club on progress or next steps." /></label>
              <button disabled={busy===`format-${request.id}`} onClick={()=>void updateFormatRequest(request.id)}>{busy===`format-${request.id}`?"Saving…":"Save request"}</button>
            </div>
            {club&&<div className={styles.clubActions}><a href={`/clubs/${encodeURIComponent(club.slug)}/admin`}>Open club admin</a></div>}
          </article>
        })}
        {!view.formatRequests.length&&<article className={styles.card}><h3>No format requests</h3><p>Requests submitted by club organisers will appear here.</p></article>}
      </section>
      <div className={styles.sectionHeading}><div><small>PLATFORM HEALTH</small><h2>Operational checks</h2></div><p>Exceptions and data-quality checks across Rallora.</p></div>
      {readiness&&<section className={`${styles.metrics} ${styles.readinessMetrics}`} aria-label="Platform health">{Object.entries(readiness).map(([key,value])=><div className={`${styles.metric} ${Number(value)>0?styles.healthAttention:styles.healthOk}`} key={key}><span>{key.replaceAll("_"," ")}</span><strong>{Number(value).toLocaleString("en-GB")}</strong></div>)}</section>}
      <p className={styles.footnote}>Subscription controls are ready for a payment provider to be connected later; no automatic charges are taken.</p>
    </>}
  </div></main>;
}
