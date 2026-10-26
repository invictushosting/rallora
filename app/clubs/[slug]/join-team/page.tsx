"use client";
import BackLink from "@/app/components/back-link";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import {useParams,useSearchParams} from "next/navigation";
import {createClient} from "@/lib/supabase";
import {inviteAuthError} from "@/lib/invite-auth";
import styles from "../register/register.module.css";

type Invite={id:string;invited_name:string;invited_email:string;status:string;team_id:string;teams:{name:string}|null};

export default function JoinTeamPage(){
 const params=useParams(),search=useSearchParams(),slug=typeof params.slug==="string"?params.slug:"";
 const inviteId=search.get("invite")??""; const supabase=useMemo(()=>createClient(),[]);
 const [invite,setInvite]=useState<Invite|null>(null);
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [accountMode,setAccountMode]=useState<"create"|"signin">("create");
 const [needsVerification,setNeedsVerification]=useState(false);
 const [signedIn,setSignedIn]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const validInviteId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inviteId);

 const load=useCallback(async()=>{
   setLoading(true);setError("");setInvite(null);
   try{
   const {data:{user}}=await supabase.auth.getUser();
   setSignedIn(Boolean(user)); setEmail(user?.email??"");
   if(!user||!validInviteId)return;
   const r=await supabase.from("rallora_team_member_invites").select("id,invited_name,invited_email,status,team_id,teams(name),clubs!inner(slug)").eq("id",inviteId).eq("clubs.slug",slug).maybeSingle();
   if(r.error){setError(r.error.message);return}
   setInvite(r.data as unknown as Invite|null);
   }catch{setError("We could not check this invite. Please try again.")}
   finally{setLoading(false)}
 },[supabase,inviteId,validInviteId,slug,setLoading,setError,setInvite,setSignedIn,setEmail]);
 useEffect(()=>{void load()},[load]);

 async function switchAccount(){
   setBusy(true);setError("");setMessage("");
   try{
     const reply=await supabase.auth.signOut();
     if(reply.error){setError("We could not sign you out. Please try again.");return}
     setPassword("");await load();
   }catch{setError("We could not sign you out. Please try again.")}
   finally{setBusy(false)}
 }

 function changeMode(mode:"create"|"signin"){
   setAccountMode(mode);setPassword("");setError("");setMessage("");setNeedsVerification(false);
 }
 async function authenticate(e:React.FormEvent){
   e.preventDefault();if(busy)return;setBusy(true);setError("");setMessage("");setNeedsVerification(false);
   try{
     if(accountMode==="signin"){
       const r=await supabase.auth.signInWithPassword({email:email.trim(),password});
       if(r.error)throw r.error;
       setPassword("");await load();
     }else{
       const r=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.href}});
       if(r.error)throw r.error;
       setPassword("");
       if(!r.data.session){
         setAccountMode("signin");setNeedsVerification(true);
         setMessage("Check your email for an account confirmation link, then return to this invitation and sign in. If you already have a Rallora account, use your existing password or Forgot password.");return;
       }
       await load();
     }
   }catch(x){
     const issue=x as {code?:string;message?:string};
     setNeedsVerification(issue.code==="email_not_confirmed"||/email not confirmed/i.test(issue.message??""));
     setError(inviteAuthError(issue,accountMode));
   }finally{setBusy(false)}
 }
 async function resendConfirmation(){
   if(busy||!email.trim())return;setBusy(true);setError("");setMessage("");
   try{
     const r=await supabase.auth.resend({type:"signup",email:email.trim(),options:{emailRedirectTo:window.location.href}});
     if(r.error)throw r.error;
     setMessage("If your account needs confirmation, a new link has been sent. Check your inbox and junk folder, then return to this invitation.");
   }catch{setError("We could not resend the confirmation email. Please wait a moment and try again.")}
   finally{setBusy(false)}
 }
 async function claim(){if(!inviteId)return;setBusy(true);setError("");const r=await supabase.rpc("rallora_claim_team_invite",{p_invite_id:inviteId});setBusy(false);if(r.error){setError(r.error.message);return}setMessage("Team place claimed. Your Rallora membership is now active.");await load()}

 return <main className={styles.page}><section className={styles.card}><BackLink href={slug?`/clubs/${slug}`:"/"}>Back to club</BackLink><span className={styles.eyebrow}>TEAM INVITE</span><h1>Join your Rallora team</h1><p>Use the email address your captain invited. New to Rallora? Create your own account first, then claim your team place. Your Playtomic password will not sign you in to Rallora.</p>
 {!validInviteId&&<p className={styles.error} role="alert">This invite link is incomplete or invalid. Ask your captain for the full invitation link.</p>}
 {!loading&&!signedIn&&validInviteId&&<>
 <div className={styles.modeSwitch} role="group" aria-label="Rallora account">
   <button type="button" disabled={busy} aria-pressed={accountMode==="create"} className={accountMode==="create"?styles.modeActive:undefined} onClick={()=>changeMode("create")}>Create account</button>
   <button type="button" disabled={busy} aria-pressed={accountMode==="signin"} className={accountMode==="signin"?styles.modeActive:undefined} onClick={()=>changeMode("signin")}>Sign in</button>
 </div>
 <form onSubmit={authenticate}>
   <label>Invited email address<input required type="email" autoComplete="email" disabled={busy} value={email} onChange={e=>{setEmail(e.target.value);setError("");setMessage("");setNeedsVerification(false)}}/><small>Use the address that received your team invitation.</small></label>
   <label>{accountMode==="create"?"Create a Rallora password":"Rallora password"}<input key={accountMode} required type="password" minLength={accountMode==="create"?8:undefined} autoComplete={accountMode==="create"?"new-password":"current-password"} disabled={busy} value={password} onChange={e=>{setPassword(e.target.value);setError("")}}/><small>{accountMode==="create"?"Choose a password with at least 8 characters.":"Use the password you created for Rallora."}</small></label>
   <button disabled={busy}>{busy?"Please wait…":accountMode==="create"?"Create account & continue":"Sign in & continue"}</button>
   {accountMode==="signin"&&<Link href={`/account?club=${encodeURIComponent(slug)}`} target="_blank" rel="noopener noreferrer">Forgot password? Reset it in a new tab, then return here.</Link>}
 </form>
 {needsVerification&&<p><button type="button" disabled={busy} onClick={()=>void resendConfirmation()}>Resend confirmation email</button></p>}
 </>}
 {!loading&&signedIn&&invite&&<div className={styles.player}><strong>{invite.teams?.name??"Your team"}</strong><p>Invite for {invite.invited_name} · {invite.invited_email}</p>{invite.status==="pending"?<button disabled={busy} onClick={()=>void claim()}>{busy?"Claiming…":"Claim team place"}</button>:invite.status==="claimed"?<><p className={styles.success}>This invite has already been claimed.</p><Link href={`/clubs/${encodeURIComponent(slug)}`}>View club fixtures and tables</Link></>:<p className={styles.error}>This invite has been cancelled. Contact your captain or club organiser for help.</p>}</div>}
 {loading&&validInviteId&&<p role="status">Checking your invite…</p>}
 {!loading&&signedIn&&!invite&&validInviteId&&!error&&<p className={styles.error} role="alert">This invite is unavailable for this account and club. Check the link and sign in with the email address your captain invited.</p>}
 {!loading&&signedIn&&validInviteId&&<p>Signed in as {email}. <button type="button" disabled={busy} onClick={()=>void switchAccount()}>Use a different account</button></p>}
 {error&&<p className={styles.error} role="alert">{error}</p>}{message&&<p className={styles.success} role="status">{message}</p>}
 </section></main>
}
