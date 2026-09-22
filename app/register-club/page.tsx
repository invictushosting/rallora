"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "@/lib/supabase";
import styles from "./register-club.module.css";

const plans=[["starter","Starter","Launch your first league","Core league · Player registration"],["league","League","For established club leagues","Everything in Starter · Captain results · Social Studio"],["pro","Pro","For ambitious club operations","Everything in League · Sponsors · Reminders"]];

export default function RegisterClub(){
  const supabase=useMemo(()=>createClient(),[]),[plan,setPlan]=useState("league");
  const [userId,setUserId]=useState<string|null>(null),[message,setMessage]=useState(""),[error,setError]=useState("");
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[mode,setMode]=useState<"signin"|"signup">("signup"),[busy,setBusy]=useState(false);
  useEffect(()=>{void supabase.auth.getUser().then(({data})=>{setUserId(data.user?.id??null);setEmail(data.user?.email??"")})},[supabase]);
  async function authenticate(){
    if(mode==="signin"){const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;setUserId(data.user.id);return data.user}
    const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.href}});if(error)throw error;
    if(!data.user||!data.session){setMessage("Check your email to confirm your account, then return here and sign in to submit your club application.");return null}
    setUserId(data.user.id);return data.user;
  }
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");setMessage("");
    try{const form=new FormData(event.currentTarget);let user=(await supabase.auth.getUser()).data.user;if(!user)user=await authenticate();if(!user)return;
      const {error:insertError}=await supabase.from("rallora_club_applications").insert({applicant_user_id:user.id,club_name:String(form.get("name")).trim(),requested_slug:String(form.get("slug")).trim().toLowerCase(),contact_email:user.email,plan_code:plan});if(insertError)throw insertError;
      setMessage("Application received. Rallora will review your club before activation.");
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not submit your application.")}finally{setBusy(false)}
  }
  return <main className={styles.page}><div className={styles.shell}><header><Link href="/">RALLORA</Link><Link href="/register">Find a league</Link></header><section className={styles.hero}><span>BUILD YOUR CLUB LEAGUE</span><h1>One platform.<br/>Every club.</h1><p>Choose the tools your club needs. No billing is taken until your application is approved.</p></section><section className={styles.plans}>{plans.map(([id,title,tag,features])=><button type="button" className={plan===id?styles.selected:""} onClick={()=>setPlan(id)} key={id}><small>{id==="league"?"MOST POPULAR":"RALLORA "+title.toUpperCase()}</small><h2>{title}</h2><strong>{tag}</strong><p>{features}</p><span>{plan===id?"Selected":"Choose plan"}</span></button>)}</section><form onSubmit={submit}><h2>Tell us about your club</h2>{!userId&&<section className={styles.account}><div className={styles.mode}><button type="button" className={mode==="signup"?styles.active:""} onClick={()=>setMode("signup")}>Create account</button><button type="button" className={mode==="signin"?styles.active:""} onClick={()=>setMode("signin")}>Sign in</button></div><label>Email<input type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)}/></label><label>Password<input type="password" minLength={8} autoComplete={mode==="signup"?"new-password":"current-password"} required value={password} onChange={event=>setPassword(event.target.value)}/></label></section>}<label>Club name<input name="name" required minLength={2}/></label><label>Club web address<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="your-club"/></label><button disabled={busy}>{busy?"Submitting…":userId?"Submit club application":mode==="signup"?"Create account & apply":"Sign in & apply"}</button>{error&&<p className={styles.error} role="alert">{error}</p>}{message&&<p className={styles.success} role="status">{message}</p>}</form></div></main>;
}
