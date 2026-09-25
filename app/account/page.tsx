"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "@/lib/supabase";
import RalloraLogo from "@/app/components/rallora-logo";
import styles from "./account.module.css";

type ClubAccess={club_id:string;role:string;clubs:{slug:string;name:string}|null};

export default function AccountPage(){
  const supabase=useMemo(()=>createClient(),[]);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [signedIn,setSignedIn]=useState(false);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [clubAccess,setClubAccess]=useState<ClubAccess[]>([]);
  const [returnClub,setReturnClub]=useState("");

  useEffect(()=>{
    setReturnClub(new URL(window.location.href).searchParams.get("club")||"");
    void (async()=>{
      const {data,error}=await supabase.auth.getUser();
      if(error||!data.user){setSignedIn(false);return}
      setSignedIn(true);
      setEmail(data.user.email??"");
      const memberships=await supabase.from("rallora_club_memberships")
        .select("club_id,role,clubs(slug,name)")
        .eq("user_id",data.user.id).eq("status","active");
      if(!memberships.error)setClubAccess((memberships.data??[]) as unknown as ClubAccess[]);
    })();
  },[supabase]);

  async function reset(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMessage("");
    const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/account`});
    setMessage(error?.message??"If this account exists, a secure password-reset email has been sent.");
    setBusy(false);
  }

  async function update(e:React.FormEvent){
    e.preventDefault();setMessage("");
    if(password!==confirmPassword){setMessage("Passwords do not match.");return}
    setBusy(true);
    const {error}=await supabase.auth.updateUser({password});
    setMessage(error?.message??"Password updated successfully.");
    if(!error){setPassword("");setConfirmPassword("")}
    setBusy(false);
  }

  const returnHref=returnClub?`/clubs/${encodeURIComponent(returnClub)}/admin`:"/";
  const returnLabel=returnClub?"← Back to club admin":"← Back to Rallora";

  return <main className={styles.page}><section className={styles.card}>
    <div className={styles.topbar}>
      <Link className={styles.brand} href="/" aria-label="Rallora home"><RalloraLogo variant="light" width={150}/></Link>
      <Link className={styles.returnLink} href={returnHref}>{returnLabel}</Link>
    </div>

    <small>YOUR ACCOUNT</small>
    <h1>{signedIn?"Profile & security":"Reset your password"}</h1>
    <p>{signedIn?"Manage your Rallora account details and password.":"Enter your Rallora account email and we’ll send a secure recovery link."}</p>

    {signedIn&&<section className={styles.profileCard}>
      <div><span>Email</span><strong>{email}</strong></div>
      <div><span>Account type</span><strong>{clubAccess.length?"Club administrator":"Rallora account"}</strong></div>
      {clubAccess.length>0&&<div className={styles.clubAccess}>
        <span>Club access</span>
        {clubAccess.map(item=><p key={item.club_id}><strong>{item.clubs?.name??"Club"}</strong><em>{item.role}</em></p>)}
      </div>}
    </section>}

    {signedIn?<section className={styles.passwordSection}>
      <h2>Change password</h2>
      <p>Choose a new password with at least 8 characters.</p>
      <form onSubmit={update}>
        <label>New password<input type="password" minLength={8} required autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <label>Confirm new password<input type="password" minLength={8} required autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>
        <button disabled={busy}>{busy?"Updating…":"Update password"}</button>
      </form>
    </section>:<form onSubmit={reset}>
      <label>Email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <button disabled={busy}>{busy?"Sending…":"Send reset email"}</button>
    </form>}

    {message&&<p className={styles.message} role="status">{message}</p>}
  </section></main>
}
