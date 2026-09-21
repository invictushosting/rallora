"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function RegisterClub() {
 const supabase=useMemo(()=>createClient(),[]); const [message,setMessage]=useState(""); const [error,setError]=useState("");
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setError(""); const form=new FormData(e.currentTarget); const {data:{user}}=await supabase.auth.getUser();
  if(!user){setError("Create or sign in to your Rallora account before registering a club.");return;}
  const name=String(form.get("name")||"").trim(); const slug=String(form.get("slug")||"").trim().toLowerCase();
  const {error}=await supabase.from("rallora_club_applications").insert({applicant_user_id:user.id,club_name:name,requested_slug:slug,contact_email:user.email,plan_code:String(form.get("plan"))});
  if(error){setError(error.message);return;} setMessage("Application received. A Rallora administrator will review it before your club is activated.");
 }
 return <main style={{maxWidth:620,margin:"50px auto",padding:24}}><Link href="/">← Rallora</Link><h1>Register your club</h1><p>Choose a starting plan. Your account is activated only after Rallora approves the application.</p>
 <form onSubmit={submit} style={{display:"grid",gap:16}}><label>Club name<input name="name" required minLength={2}/></label><label>Club web address<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="your-club"/></label><label>Plan<select name="plan"><option value="starter">Starter</option><option value="league">League</option><option value="pro">Pro</option></select></label><button>Submit application</button></form>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</main>;
}
