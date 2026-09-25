"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import styles from "../admin.module.css";

type Club = { id:string; slug:string; name:string };
type RequestRow = {
  id:string; format_name:string; description:string; status:string;
  platform_notes:string|null; implemented_format_key:string|null; created_at:string;
};

export default function FormatRequestPage(){
  const params=useParams();
  const slug=typeof params.slug==="string"?params.slug:"";
  const supabase=useMemo(()=>createClient(),[]);
  const [club,setClub]=useState<Club|null>(null);
  const [requests,setRequests]=useState<RequestRow[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function load(){
    setError("");
    const {data:{user},error:authError}=await supabase.auth.getUser();
    if(authError||!user){setError("Sign in to request a league format.");return}
    const {data:clubRow,error:clubError}=await supabase.from("clubs")
      .select("id,slug,name").eq("slug",slug).maybeSingle();
    if(clubError||!clubRow){setError("Club not found.");return}
    setClub(clubRow as Club);
    const {data,error:reqError}=await supabase.from("rallora_format_requests")
      .select("id,format_name,description,status,platform_notes,implemented_format_key,created_at")
      .eq("club_id",clubRow.id).order("created_at",{ascending:false});
    if(reqError){setError(reqError.message);return}
    setRequests((data??[]) as RequestRow[]);
  }

  useEffect(()=>{if(slug)void load()},[slug]);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!club)return;
    setBusy(true);setError("");setMessage("");
    try{
      const {data:{user},error:authError}=await supabase.auth.getUser();
      if(authError||!user)throw new Error("Sign in again before submitting.");
      const form=new FormData(event.currentTarget);
      const row={
        club_id:club.id,
        requested_by:user.id,
        format_name:String(form.get("formatName")||"").trim(),
        description:String(form.get("description")||"").trim(),
        team_structure:String(form.get("teamStructure")||"").trim()||null,
        group_structure:String(form.get("groupStructure")||"").trim()||null,
        match_structure:String(form.get("matchStructure")||"").trim()||null,
        scheduling_rules:String(form.get("schedulingRules")||"").trim()||null,
        scoring_rules:String(form.get("scoringRules")||"").trim()||null,
        promotion_relegation_rules:String(form.get("promotionRules")||"").trim()||null,
        special_rules:String(form.get("specialRules")||"").trim()||null,
        reference_link:String(form.get("referenceLink")||"").trim()||null,
      };
      const {error:insertError}=await supabase.from("rallora_format_requests").insert(row);
      if(insertError)throw insertError;
      event.currentTarget.reset();
      setMessage("Format request sent to Rallora. We’ll review the specification and update its status here.");
      await load();
    }catch(caught){
      setError(caught instanceof Error?caught.message:"Could not submit the request.");
    }finally{setBusy(false)}
  }

  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.nav}>
      <Link href={club?`/clubs/${club.slug}/admin`:`/clubs/${slug}/admin`} className={styles.wordmark}>← Club administration</Link>
    </header>
    <section className={styles.hero}>
      <span className={styles.eyebrow}>LEAGUE FORMATS</span>
      <h1>Request a league format</h1>
      <p>Every club runs competitions differently. Tell us exactly how yours works and Rallora will review whether it can be added to your club.</p>
    </section>

    {error&&<section className={styles.message}><p role="alert">{error}</p></section>}
    {message&&<section className={styles.message}><p role="status">{message}</p></section>}

    <section className={styles.card}>
      <h3>Describe the format</h3>
      <p>Give us enough detail to reproduce the league without needing to guess. Submitting a request does not automatically guarantee development; Rallora will review it first.</p>
      <form className={styles.loginForm} onSubmit={submit}>
        <label>Format name<input name="formatName" required minLength={2} maxLength={120} placeholder="e.g. Rolling 4-team promotion league" /></label>
        <label>How does the league work?<textarea name="description" required minLength={10} maxLength={5000} rows={6} placeholder="Describe the full journey from registration through to the end of the league." /></label>
        <label>Team / player structure<textarea name="teamStructure" rows={3} placeholder="e.g. Teams of 2, 24 teams total" /></label>
        <label>Groups or divisions<textarea name="groupStructure" rows={3} placeholder="e.g. 6 groups of 4 teams, seeded by combined Playtomic rating" /></label>
        <label>Matches / rounds<textarea name="matchStructure" rows={3} placeholder="e.g. Each team plays 3 matches per cycle" /></label>
        <label>Scheduling<textarea name="schedulingRules" rows={3} placeholder="e.g. No fixed day; teams arrange matches within each monthly window" /></label>
        <label>Scoring / standings<textarea name="scoringRules" rows={3} placeholder="Points, tie-break rules, set scoring, etc." /></label>
        <label>Promotion / relegation<textarea name="promotionRules" rows={3} placeholder="e.g. 1st promoted, 4th relegated after every cycle" /></label>
        <label>Special rules<textarea name="specialRules" rows={4} placeholder="Anything else Rallora needs to know" /></label>
        <label>Reference link <small>(optional)</small><input name="referenceLink" type="url" placeholder="Rules page, spreadsheet or example link" /></label>
        <button disabled={busy}>{busy?"Sending request…":"Submit format for review"}</button>
      </form>
    </section>

    <section className={styles.card}>
      <h3>Your format requests</h3>
      {!requests.length&&<p>No format requests submitted yet.</p>}
      {requests.map(item=><article key={item.id} className={styles.formatRequestRow}>
        <div><span className={styles.status}>{item.status.replaceAll("_"," ")}</span><strong>{item.format_name}</strong>
          <p>{item.description}</p>
          <small>Submitted {new Date(item.created_at).toLocaleDateString("en-GB")}</small></div>
        {item.platform_notes&&<aside><strong>Rallora note</strong><p>{item.platform_notes}</p></aside>}
        {item.status==="available"&&<p className={styles.success}>✓ This format is available for your club{item.implemented_format_key?` as ${item.implemented_format_key}`:""}.</p>}
      </article>)}
    </section>
  </div></main>;
}
