"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {useParams,useSearchParams} from "next/navigation";
import {createClient} from "@/lib/supabase";
import styles from "../register/register.module.css";

type Invite={id:string;invited_name:string;invited_email:string;status:string;team_id:string;teams:{name:string}|null};

export default function JoinTeamPage(){
 const params=useParams(),search=useSearchParams(),slug=typeof params.slug==="string"?params.slug:"";
 const inviteId=search.get("invite")??""; const supabase=useMemo(()=>createClient(),[]);
 const [invite,setInvite]=useState<Invite|null>(null),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[signedIn,setSignedIn]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);

 async function load(){
   setError("");
   const {data:{user}}=await supabase.auth.getUser();
   setSignedIn(Boolean(user)); setEmail(user?.email??"");
   if(!user||!inviteId)return;
   const r=await supabase.from("rallora_team_member_invites").select("id,invited_name,invited_email,status,team_id,teams(name)").eq("id",inviteId).maybeSingle();
   if(r.error){setError(r.error.message);return}
   setInvite(r.data as unknown as Invite|null);
 }
 useEffect(()=>{void load()},[inviteId]);

 async function signIn(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");const r=await supabase.auth.signInWithPassword({email:email.trim(),password});setBusy(false);if(r.error){setError(r.error.message);return}await load()}
 async function signUp(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");const r=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.href}});setBusy(false);if(r.error){setError(r.error.message);return}if(!r.data.session){setMessage("Check your email to confirm your account, then return to this invite link.");return}await load()}
 async function claim(){if(!inviteId)return;setBusy(true);setError("");const r=await supabase.rpc("rallora_claim_team_invite",{p_invite_id:inviteId});setBusy(false);if(r.error){setError(r.error.message);return}setMessage("Team place claimed. Your Rallora membership is now active.");await load()}

 return <main className={styles.page}><section className={styles.card}><Link className={styles.back} href={slug?`/clubs/${slug}`:"/"}>← Back to club</Link><span className={styles.eyebrow}>TEAM INVITE</span><h1>Join your Rallora team</h1><p>Sign in with the email address your captain registered for you, then claim your team place.</p>
 {!inviteId&&<p className={styles.error}>This invite link is incomplete.</p>}
 {!signedIn&&inviteId&&<><form onSubmit={signIn}><label>Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input required type="password" minLength={8} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>Sign in & continue</button></form><p>New to Rallora?</p><form onSubmit={signUp}><label>Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Create password<input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>Create account</button></form></>}
 {signedIn&&invite&&<div className={styles.player}><strong>{invite.teams?.name??"Your team"}</strong><p>Invite for {invite.invited_name} · {invite.invited_email}</p>{invite.status==="pending"?<button disabled={busy} onClick={()=>void claim()}>{busy?"Claiming…":"Claim team place"}</button>:<p className={styles.success}>This invite has already been claimed.</p>}</div>}
 {signedIn&&!invite&&inviteId&&!error&&<p>Checking your invite…</p>}
 {error&&<p className={styles.error} role="alert">{error}</p>}{message&&<p className={styles.success} role="status">{message}</p>}
 </section></main>
}