"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import {createClient} from "@/lib/supabase";
import RalloraLogo from "@/app/components/rallora-logo";
import styles from "./discover.module.css";

type Candidate={user_id:string;display_name:string;playing_level:string|null;home_town:string|null;partner_preference:string|null;shared_clubs:number;match_score:number};
type Request={id:string;from_user:string;to_user:string;message:string|null;status:string;created_at:string};
export default function PlayerDiscovery(){
 const supabase=useMemo(()=>createClient(),[]);
 const [userId,setUserId]=useState("");
 const [loading,setLoading]=useState(true);
 const [visible,setVisible]=useState(false);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [candidates,setCandidates]=useState<Candidate[]>([]);
 const [requests,setRequests]=useState<Request[]>([]);
 const [message,setMessage]=useState("");
 const [profileReady,setProfileReady]=useState(false);
 const refresh=useCallback(async(id:string,enabled:boolean)=>{
   const req=await supabase.from("rallora_partner_requests")
     .select("id,from_user,to_user,message,status,created_at")
     .or(`from_user.eq.${id},to_user.eq.${id}`).order("created_at",{ascending:false}).limit(80);
   if(req.error)throw req.error;
   setRequests((req.data??[]) as Request[]);
   if(enabled){
     const reply=await supabase.rpc("rallora_find_partners",{p_limit:30});
     if(reply.error)throw reply.error;
     setCandidates((reply.data??[]) as Candidate[]);
   } else setCandidates([]);
 },[supabase]);
 useEffect(()=>{
   let mounted=true;
   void (async()=>{
     try{
       const {data:{user},error}=await supabase.auth.getUser();
       if(error)throw error;
       if(!mounted)return;
       if(!user){setLoading(false);return;}
       setUserId(user.id);
       const [setting,profile]=await Promise.all([
         supabase.from("rallora_player_discovery").select("is_visible").eq("user_id",user.id).maybeSingle(),
         supabase.from("rallora_player_profiles").select("display_name,partner_preference").eq("user_id",user.id).maybeSingle()
       ]);
       if(setting.error)throw setting.error;
       if(profile.error)throw profile.error;
       const ready=Boolean(profile.data?.display_name&&["looking","open"].includes(profile.data.partner_preference??""));
       setProfileReady(ready);
       const enabled=Boolean(setting.data?.is_visible);
       setVisible(enabled);
       await refresh(user.id,enabled);
     }catch(e){if(mounted)setNotice(e instanceof Error?e.message:"Unable to load partner discovery.");}
     finally{if(mounted)setLoading(false);}
   })();
   return ()=>{mounted=false;};
 },[supabase,refresh]);
 async function toggle(){
   setBusy(true);setNotice("");
   const next=!visible;
   try{
     if(!userId)throw new Error("Sign in first");
     if(next&&!profileReady)throw new Error("Set your display name and partner preference to Looking or Open on your profile first.");
     const r=await supabase.from("rallora_player_discovery").upsert({user_id:userId,is_visible:next,updated_at:new Date().toISOString()},{onConflict:"user_id"});
     if(r.error)throw r.error;
     setVisible(next);await refresh(userId,next);
     setNotice(next?"You're now visible to other opted-in players.":"Discovery turned off. You won't appear in new player searches.");
   }catch(e){setNotice(e instanceof Error?e.message:"Could not change visibility.");}
   finally{setBusy(false);}
 }
 async function send(to:string){
   setBusy(true);setNotice("");
   const r=await supabase.rpc("rallora_request_partner",{p_to:to,p_message:message.trim()||null});
   if(r.error)setNotice(r.error.message);
   else{setMessage("");setNotice("Partner request sent. No email or phone number was shared.");await refresh(userId,visible).catch(()=>{});}
   setBusy(false);
 }
 async function answer(id:string,decision:"accepted"|"declined"|"cancelled"){
   setBusy(true);setNotice("");
   const r=await supabase.rpc("rallora_answer_partner_request",{p_request_id:id,p_decision:decision});
   if(r.error)setNotice(r.error.message);
   else{setNotice("Request updated.");await refresh(userId,visible).catch(()=>{});}
   setBusy(false);
 }
 const sent=new Set(requests.filter(r=>r.from_user===userId&&r.status!=="cancelled"&&r.status!=="declined").map(r=>r.to_user));
 const names=new Map(candidates.map(c=>[c.user_id,c.display_name]));
 return <main className={styles.page}><div className={styles.shell}>
   <header className={styles.header}><Link href="/"><RalloraLogo variant="light" width={146}/></Link><Link href="/account">Player profile</Link></header>
   <span className={styles.eyebrow}>RALLORA SOCIAL · PLAYER DISCOVERY</span>
   <h1>Find your next padel partner</h1>
   <p className={styles.intro}>Discover players who have chosen to be visible, compare playing levels and shared clubs, and request a connection without exposing personal contact details.</p>
   {loading?<p role="status">Loading your preferences…</p>:!userId?<p>Please <Link href="/login">sign in</Link> or <Link href="/signup">create a free account</Link> to use partner discovery.</p>:<>
    <section className={styles.panel}><h2>Discovery privacy</h2><p>Off by default. When enabled, other opted-in players can see your display name, playing level, town or city, partner preference and shared-club match score. Your phone and email stay private.</p>
      <button type="button" disabled={busy||(!visible&&!profileReady)} onClick={toggle}>{visible?"Turn discovery off":"Enable player discovery"}</button>
      {!profileReady&&<p>To enable discovery, first set a display name and select “Looking for a partner” or “Open to playing with others” in <Link href="/account">your profile</Link>.</p>}
    </section>
    {notice&&<p role="status" className={styles.notice}>{notice}</p>}
    {visible&&<section className={styles.panel}><h2>Suggested partners</h2><p>Sorted by playing level, shared preferred clubs and town/city. Matches are suggestions, not guarantees.</p>
      <label className={styles.message}>Optional message (280 characters)<textarea maxLength={280} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Hi! Would you like to arrange a game?"/></label>
      <div className={styles.results}>{candidates.map(c=><article key={c.user_id} className={styles.candidate}>
        <div><h3>{c.display_name}</h3><p>{[c.playing_level?.replaceAll("_"," "),c.home_town].filter(Boolean).join(" · ")||"Player"}</p><small>{c.shared_clubs} shared preferred clubs · Compatibility score {c.match_score}</small></div>
        <button disabled={busy||sent.has(c.user_id)} onClick={()=>void send(c.user_id)}>{sent.has(c.user_id)?"Requested":"Request to connect"}</button>
      </article>)}
      {!candidates.length&&<p>No opted-in partners found yet. Try again after more players join.</p>}</div>
    </section>}
    <section className={styles.panel}><h2>Partner requests</h2>
      <div className={styles.results}>{requests.map(r=><article key={r.id} className={styles.candidate}>
        <div><h3>{r.from_user===userId?"Sent request":"Incoming request"}</h3><p>{r.from_user===userId?(names.get(r.to_user)??"Player"):(names.get(r.from_user)??"Another Rallora player")} · {r.status}</p>{r.message&&<p>{r.message}</p>}</div>
        {r.status==="pending"&&<div className={styles.actions}>{r.to_user===userId?<><button disabled={busy} onClick={()=>void answer(r.id,"accepted")}>Accept</button><button disabled={busy} onClick={()=>void answer(r.id,"declined")}>Decline</button></>:<button disabled={busy} onClick={()=>void answer(r.id,"cancelled")}>Cancel</button>}</div>}
      </article>)}{!requests.length&&<p>No partner requests yet.</p>}</div>
      <p>Accepting a request marks it as accepted. Direct messaging and sharing contact details are not enabled yet.</p>
    </section>
   </>}
 </div></main>;
}
