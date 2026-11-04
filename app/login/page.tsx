"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import RalloraLogo from "@/app/components/rallora-logo";
import {createClient} from "@/lib/supabase";
import {loginDestinations,type ClubRole,type LoginDestination} from "@/lib/login-destinations";
import styles from "./login.module.css";

export default function LoginPage(){
  const supabase=useMemo(()=>createClient(),[]),router=useRouter();
  const [email,setEmail]=useState(""),[password,setPassword]=useState("");
  const [signedIn,setSignedIn]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [destinations,setDestinations]=useState<LoginDestination[]>([]);
  const loadVersion=useRef(0);
  const load=useCallback(async()=>{
    const version=++loadVersion.current;
    setLoading(true);setError("");setDestinations([]);
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(version!==loadVersion.current)return;
      setSignedIn(Boolean(user));
      if(!user)return;
      setEmail(user.email??"");
      const [platform,memberships,roster]=await Promise.all([
        supabase.from("rallora_platform_admins").select("user_id").eq("user_id",user.id).maybeSingle(),
        supabase.from("rallora_club_memberships").select("role,clubs(slug,name,is_active)").eq("user_id",user.id).eq("status","active"),
        supabase.from("rallora_team_roster_memberships").select("role,clubs(slug,name,is_active)").eq("player_user_id",user.id),
      ]);
      if(version!==loadVersion.current)return;
      if(platform.error||memberships.error||roster.error)throw new Error("We couldn’t load your club access. Please try again.");
      const links=loginDestinations(Boolean(platform.data),(memberships.data??[]) as unknown as ClubRole[],(roster.data??[]) as unknown as ClubRole[]);
      setDestinations(links);
      if(links.length===1)router.replace(links[0].href);
    }catch(caught){if(version===loadVersion.current)setError(caught instanceof Error?caught.message:"We couldn’t load your account. Please try again.")}
    finally{if(version===loadVersion.current)setLoading(false)}
  },[supabase,router]);
  useEffect(()=>{void load();return()=>{loadVersion.current++}},[load]);
  async function signIn(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    try{
      const reply=await supabase.auth.signInWithPassword({email:email.trim(),password});
      if(reply.error)throw reply.error;
      setPassword("");await load();
    }catch(caught){setError(caught instanceof Error?caught.message:"We couldn’t sign you in. Please try again.")}
    finally{setBusy(false)}
  }
  async function signOut(){
    setBusy(true);setError("");
    try{
      const reply=await supabase.auth.signOut();if(reply.error)throw reply.error;
      setSignedIn(false);setDestinations([]);setPassword("");setEmail("");
    }catch{setError("We couldn’t sign you out. Please try again.")}
    finally{setBusy(false)}
  }
  return <main className={styles.page}><section className={styles.panel}>
    <Link href="/" aria-label="Rallora home"><RalloraLogo variant="light" width={190}/></Link>
    <span className={styles.eyebrow}>YOUR CLUB. YOUR LEAGUE.</span>
    <h1>{signedIn?"Welcome back":"Sign in to Rallora"}</h1>
    {loading?<p role="status">Finding your club…</p>:signedIn?<>
      <p className={styles.email}>Signed in as {email}</p>
      {destinations.length>0?<><p>Choose where you’d like to go.</p><nav className={styles.destinations} aria-label="Your club areas">{destinations.map(item=><Link key={item.href} href={item.href}><strong>{item.club}</strong><span>{item.label}</span></Link>)}</nav></>:!error&&<p>Your Rallora account is ready. You can <Link href="/account">complete your player profile</Link> or <Link href="/register">explore clubs and competitions</Link>. If your partner registered you, return to your team invitation and claim your place to connect this account to your pairing.</p>}
      {error&&<button type="button" disabled={busy} onClick={()=>void load()}>Try again</button>}
      <div className={styles.accountLinks}><Link href="/account">Profile & security</Link><button type="button" disabled={busy} onClick={()=>void signOut()}>Use a different account</button></div>
    </>:<><p>Both team members can sign in with their own Rallora account. Use your Rallora email and password to access fixtures and match chat.</p>
      <form onSubmit={signIn}><label>Email<input type="email" autoComplete="username" required value={email} onChange={event=>setEmail(event.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)}/></label><button disabled={busy}>{busy?"Signing in…":"Sign in"}</button></form>
      <Link className={styles.forgot} href="/account">Forgot your password?</Link><p>New to Rallora? <Link href="/signup">Create a free player account</Link> — no competition required.</p>
    </>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.newClub}>New club? <Link href="/">Become a pilot club</Link></div>
  </section></main>;
}
