"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "@/lib/supabase";
import styles from "./account.module.css";
export default function AccountPage(){const supabase=useMemo(()=>createClient(),[]),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[signedIn,setSignedIn]=useState(false),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
useEffect(()=>{void supabase.auth.getUser().then(({data})=>{setSignedIn(Boolean(data.user));setEmail(data.user?.email??"")})},[supabase]);
async function reset(e:React.FormEvent){e.preventDefault();setBusy(true);const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/account`});setMessage(error?.message??"If this account exists, a secure password-reset email has been sent.");setBusy(false)}
async function update(e:React.FormEvent){e.preventDefault();setBusy(true);const {error}=await supabase.auth.updateUser({password});setMessage(error?.message??"Password updated successfully.");if(!error)setPassword("");setBusy(false)}
return <main className={styles.page}><section className={styles.card}><Link href="/">← Rallora</Link><small>ACCOUNT SECURITY</small><h1>{signedIn?"Manage your account":"Reset your password"}</h1><p>{signedIn?`Signed in as ${email}. Choose a new password below.`:"Enter your Rallora account email and we’ll send a secure recovery link."}</p>{signedIn?<form onSubmit={update}><label>New password<input type="password" minLength={8} required autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>Update password</button></form>:<form onSubmit={reset}><label>Email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><button disabled={busy}>Send reset email</button></form>}{message&&<p className={styles.message} role="status">{message}</p>}</section></main>}
