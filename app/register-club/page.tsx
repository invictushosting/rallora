"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import RalloraLogo from "@/app/components/rallora-logo";
import {createClient} from "@/lib/supabase";
import styles from "./register-club.module.css";

const plans=[
  {id:"starter",title:"Starter",tag:"Run your league",summary:"For clubs launching their first organised league.",features:["1 active league","Up to 16 teams","Fixtures, results & standings","Player registration","Paid registration ready"]},
  {id:"league",title:"Growth",tag:"Grow your competitions",summary:"For clubs running more leagues with less admin.",features:["Up to 3 active leagues","Up to 64 teams","Everything in Starter","Captain result workflows","Custom registration & exports","Club events & automation","Social Studio & reporting"]},
  {id:"pro",title:"Pro",tag:"Automate your club",summary:"For ambitious clubs scaling their competition programme.",features:["Up to 10 active leagues","Up to 250 teams","Everything in Growth","Advanced automation","Sponsors & reminders","Advanced analytics","Priority support","API & messaging integrations as available"]},
];

export default function RegisterClub(){
  const supabase=useMemo(()=>createClient(),[]),[plan,setPlan]=useState("league");
  const [userId,setUserId]=useState<string|null>(null),[message,setMessage]=useState(""),[error,setError]=useState("");
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[mode,setMode]=useState<"signin"|"signup">("signup"),[busy,setBusy]=useState(false),[compare,setCompare]=useState(false);
  useEffect(()=>{void supabase.auth.getUser().then(({data})=>{setUserId(data.user?.id??null);setEmail(data.user?.email??"")})},[supabase]);
  async function authenticate(){
    if(mode==="signin"){const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;setUserId(data.user.id);setPassword("");setMessage("Signed in. Complete your club details below to apply.");return data.user}
    const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.href}});if(error)throw error;
    if(!data.user||!data.session){setMessage("Check your email to confirm your account, then return here and sign in to submit your club application.");return null}
    setUserId(data.user.id);return data.user;
  }
  async function signIn(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");setMessage("");
    try{await authenticate()}catch(reason){setError(reason instanceof Error?reason.message:"Could not sign in.")}finally{setBusy(false)}
  }
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");setMessage("");
    try{const form=new FormData(event.currentTarget);let user=(await supabase.auth.getUser()).data.user;if(!user)user=await authenticate();if(!user)return;
      const {error:insertError}=await supabase.from("rallora_club_applications").insert({applicant_user_id:user.id,applicant_name:String(form.get("managerName")).trim(),club_name:String(form.get("name")).trim(),requested_slug:String(form.get("slug")).trim().toLowerCase(),contact_email:user.email,plan_code:plan});if(insertError)throw insertError;
      setMessage("Application received. Rallora will review your club before activation.");
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not submit your application.")}finally{setBusy(false)}
  }
  return <main className={styles.page}><div className={styles.shell}>
    <header><Link href="/" aria-label="Rallora home"><RalloraLogo variant="light" width={172}/></Link><Link className={styles.homeLink} href="/">← Back to home</Link></header>
    <section className={styles.hero}><span>BUILD YOUR CLUB LEAGUE</span><h1>One platform.<br/>Every club.</h1><p>Choose the tools your club needs. No billing is taken until your application is approved.</p></section>
    {!(mode==="signin"&&!userId)&&<>
      <section className={styles.planHeading}><div><span>CHOOSE YOUR PLAN</span><h2>Start simple. Scale when you need to.</h2></div><button type="button" onClick={()=>setCompare(value=>!value)}>{compare?"Hide comparison":"Compare plans +"}</button></section>
      <section className={styles.plans}>{plans.map(item=><button type="button" className={plan===item.id?styles.selected:""} onClick={()=>setPlan(item.id)} key={item.id}><small>{item.id==="league"?"MOST POPULAR":"RALLORA "+item.title.toUpperCase()}</small><h2>{item.title}</h2><strong>{item.tag}</strong><p>{item.summary}</p><ul>{item.features.slice(0,compare?item.features.length:3).map(feature=><li key={feature}>{feature}</li>)}</ul><span>{plan===item.id?"✓ Selected":"Choose "+item.title}</span></button>)}</section>
    </>}
    {mode==="signin"&&!userId?<form className={styles.signInOnly} onSubmit={signIn}><h2>Sign in to continue</h2><p>Already have a Rallora account? Sign in first, then we’ll show your club application details.</p><section className={styles.account}><label>Email<input type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)}/></label></section><button disabled={busy}>{busy?"Signing in…":"Sign in"}</button><button className={styles.textButton} type="button" onClick={()=>{setMode("signup");setError("");setMessage("")}}>Need an account? Create one</button>{error&&<p className={styles.error} role="alert">{error}</p>}{message&&<p className={styles.success} role="status">{message}</p>}</form>
    :<form onSubmit={submit}><span className={styles.formKicker}>CLUB APPLICATION</span><h2>Tell us about you and your club</h2><p className={styles.formIntro}>The person applying will become the main Rallora administrator for the club once approved.</p>{!userId&&<section className={styles.account}><div className={styles.mode}><button type="button" className={styles.active}>Create account</button><button type="button" onClick={()=>{setMode("signin");setError("");setMessage("")}}>Sign in</button></div><label>Email<input type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)}/></label><label>Password<input type="password" minLength={8} autoComplete="new-password" required value={password} onChange={event=>setPassword(event.target.value)}/></label></section>}<label>Owner / management name<span className={styles.hint}>Main contact and club administrator</span><input name="managerName" autoComplete="name" required minLength={2}/></label><label>Club name<input name="name" required minLength={2}/></label><label>Club web address<span className={styles.hint}>Your Rallora page — rallora.app/clubs/your-club</span><div className={styles.slugField}><span>rallora.app/clubs/</span><input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="your-club"/></div></label><button disabled={busy}>{busy?"Submitting…":userId?"Submit club application":"Create account & apply"}</button>{!userId&&<button className={styles.textButton} type="button" onClick={()=>{setMode("signin");setError("");setMessage("")}}>Already have an account? Sign in</button>}{error&&<p className={styles.error} role="alert">{error}</p>}{message&&<p className={styles.success} role="status">{message}</p>}</form>}
  </div></main>;
}
