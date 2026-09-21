"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import styles from "../admin.module.css";

type Request = { id:string; player_name:string; player_phone:string|null; status:string; created_at:string; teams:{name:string}|null };
export default function RegistrationReviewPage() {
  const params=useParams(); const slug=typeof params.slug === "string" ? params.slug : "";
  const supabase=useMemo(()=>createClient(),[]); const [requests,setRequests]=useState<Request[]>([]); const [state,setState]=useState("Loading…");
  const load=async()=>{setState("Loading…"); const {data:{user}}=await supabase.auth.getUser(); if(!user){setState("Sign in from the club administration page first.");return;}
    const clubReply=await supabase.from("clubs").select("id").eq("slug",slug).maybeSingle(); if(clubReply.error||!clubReply.data){setState("Club not found.");return;}
    const membership=await supabase.from("rallora_club_memberships").select("role,status").eq("club_id",clubReply.data.id).eq("user_id",user.id).maybeSingle(); const platform=await supabase.from("rallora_platform_admins").select("user_id").eq("user_id",user.id).maybeSingle();
    if(!platform.data && (!membership.data || membership.data.status!=="active" || !["owner","admin","organiser"].includes(membership.data.role))){setState("Your account cannot review this club’s registrations.");return;}
    const reply=await supabase.from("rallora_team_registration_requests").select("id,player_name,player_phone,status,created_at,teams(name)").eq("club_id",clubReply.data.id).order("created_at",{ascending:false}); if(reply.error){setState(reply.error.message);return;} setRequests((reply.data??[]) as unknown as Request[]);setState(""); };
  useEffect(()=>{if(slug) void load();},[slug]);
  const review=async(id:string,status:"approved"|"declined")=>{const {data:{user}}=await supabase.auth.getUser(); if(!user)return; const reply=await supabase.from("rallora_team_registration_requests").update({status,reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",id); if(reply.error){setState(reply.error.message);return;} await load();};
  return <main className={styles.page}><div className={styles.shell}><header className={styles.nav}><Link href={`/clubs/${slug}/admin`} className={styles.wordmark}>← Club administration</Link></header><section className={styles.hero}><span className={styles.eyebrow}>PLAYER REGISTRATION</span><h1>Requests awaiting approval</h1><p>Approving a request adds that player to the private team roster.</p></section>{state?<section className={styles.message}><p>{state}</p></section>:<section className={styles.grid}>{requests.map((request)=><article className={styles.card} key={request.id}><span className={styles.status}>{request.status}</span><h3>{request.player_name}</h3><p>{request.teams?.name??"Unknown team"}{request.player_phone?` · ${request.player_phone}`:""}</p><p>Submitted {new Date(request.created_at).toLocaleDateString("en-GB")}</p>{request.status==="pending"&&<div className={styles.actionRow}><button onClick={()=>void review(request.id,"approved")}>Approve</button><button onClick={()=>void review(request.id,"declined")}>Decline</button></div>}</article>)}{!requests.length&&<article className={styles.card}><h3>No registration requests</h3><p>New player requests will appear here.</p></article>}</section>}</div></main>;
}
