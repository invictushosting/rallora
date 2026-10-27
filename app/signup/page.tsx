"use client";

import Link from "next/link";
import {useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import RalloraLogo from "@/app/components/rallora-logo";
import {createClient} from "@/lib/supabase";
import styles from "./signup.module.css";

export default function PlayerSignup(){
  const supabase=useMemo(()=>createClient(),[]);
  const router=useRouter();
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [success,setSuccess]=useState(false);

  async function createAccount(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setMessage("");setBusy(true);
    try{
      const displayName=name.trim();
      if(displayName.length<2||displayName.length>120)throw new Error("Enter your name (2–120 characters).");
      if(password.length<8)throw new Error("Use a password of at least 8 characters.");
      if(password!==confirm)throw new Error("Passwords do not match.");
      const cleanEmail=email.trim().toLowerCase();
      const {data,error}=await supabase.auth.signUp({
        email:cleanEmail,password,
        options:{
          data:{display_name:displayName},
          emailRedirectTo:`${window.location.origin}/account`
        }
      });
      if(error)throw error;
      if(data.session?.user){
        const saved=await supabase.from("rallora_player_profiles").upsert({
          user_id:data.session.user.id,display_name:displayName,updated_at:new Date().toISOString()
        },{onConflict:"user_id"});
        if(saved.error){setMessage("Your account was created. Finish setting up your player profile from Account.");setSuccess(true);return;}
        router.replace("/account");
        return;
      }
      setSuccess(true);setPassword("");setConfirm("");
    }catch(caught){setMessage(caught instanceof Error?caught.message:"We couldn't create your account. Please try again.");}
    finally{setBusy(false);}
  }

  return <main className={styles.page}><section className={styles.panel}>
    <Link href="/" aria-label="Rallora home"><RalloraLogo variant="light" width={180}/></Link>
    <span className={styles.eyebrow}>YOUR PADEL JOURNEY STARTS HERE</span>
    {success?<><h1>Check your email</h1><p>Follow the verification link if one was sent, then <Link href="/login">sign in</Link>. Your Rallora account is separate from competition entry, so you can explore before joining a league.</p>{message&&<p role="status" className={styles.notice}>{message}</p>}<Link className={styles.actionLink} href="/login">Go to sign in</Link></>:<>
      <h1>Create your free Rallora account</h1>
      <p>Set up your player identity now. You can discover clubs and join competitions whenever you are ready.</p>
      <form onSubmit={createAccount}>
        <label>Your name<input required maxLength={120} minLength={2} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label>
        <label>Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>Password<input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <label>Confirm password<input required type="password" minLength={8} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
        {message&&<p role="alert" className={styles.error}>{message}</p>}
        <button disabled={busy}>{busy?"Creating account…":"Create account"}</button>
      </form>
      <p className={styles.secondary}>Already have an account? <Link href="/login">Sign in</Link></p>
      <p className={styles.secondary}>Want to play now? <Link href="/register">Explore Rallora clubs</Link></p>
    </>}
  </section></main>;
}
