"use client";

import {useMemo,useState} from "react";
import RalloraLogo from "@/app/components/rallora-logo";
import {createClient} from "@/lib/supabase";
import styles from "./page.module.css";

export default function RalloraHome(){
  const supabase=useMemo(()=>createClient(),[]);
  const [busy,setBusy]=useState(false),[submitted,setSubmitted]=useState(false),[error,setError]=useState("");
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    try{
      const formElement=event.currentTarget;
      const form=new FormData(formElement);
      const payload={
        clubName:String(form.get("clubName")||"").trim(),
        name:String(form.get("name")||"").trim(),
        email:String(form.get("email")||"").trim().toLowerCase(),
        phone:String(form.get("phone")||"").trim()||null,
        location:String(form.get("location")||"").trim(),
        courts:String(form.get("courts")||"").trim()?Number(form.get("courts")):null,
        interest:String(form.get("interest")||"pilot"),
        message:String(form.get("message")||"").trim()||null,
      };
      const response=await fetch("/api/pilot-enquiries",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const body=await response.json().catch(()=>({})) as {error?:string};
      if(!response.ok)throw new Error(body.error||"We couldn't send your enquiry.");
      formElement.reset();setSubmitted(true);
    }catch(reason){setError(reason instanceof Error?reason.message:"We couldn't send your enquiry. Please try again.");}
    finally{setBusy(false);}
  }
  return <main className={styles.pilotPage}>
    <header className={styles.pilotHeader}><RalloraLogo variant="light" width={190}/><span>PADEL LEAGUES · SIMPLIFIED</span></header>
    <section className={styles.pilotHero}>
      <div className={styles.pilotIntro}><span className={styles.pilotEyebrow}>RALLORA · PILOT PROGRAMME</span><h1>Run better leagues.<br/><em>Build a stronger club.</em></h1><p>Rallora is a modern league and competition platform built for padel clubs — simplifying registrations, teams, fixtures, results, standings and club administration.</p><strong>Launching with selected pilot clubs.</strong><div className={styles.pilotFlow}><span>Registrations</span><i>→</i><span>Teams</span><i>→</i><span>Fixtures</span><i>→</i><span>Results</span><i>→</i><span>Standings</span></div></div>
      <div className={styles.pilotFormWrap}>{submitted?<div className={styles.pilotSuccess}><span>ENQUIRY RECEIVED</span><h2>You&apos;re in the Rallora queue.</h2><p>We'll review your details and get back to you about the pilot programme or the information you&apos;ve requested.</p><button type="button" onClick={()=>setSubmitted(false)}>Submit another club →</button></div>:<form className={styles.pilotForm} onSubmit={submit}><span>GET IN TOUCH</span><h2>Become a Pilot Club</h2><p>Tell us a little about your club and we&apos;ll be in touch.</p><div className={styles.pilotFormGrid}><label>Club name<input name="clubName" required/></label><label>Your name<input name="name" required/></label><label>Email<input name="email" type="email" required/></label><label>Phone <small>Optional</small><input name="phone" type="tel"/></label><label>Club location<input name="location" required placeholder="e.g. Manchester, UK"/></label><label>Number of courts <small>Optional</small><input name="courts" type="number" min="1" max="100"/></label></div><label>I'm interested in<select name="interest"><option value="pilot">Becoming a pilot club</option><option value="information">Finding out more</option></select></label><label>Message <small>Optional</small><textarea name="message" rows={4} maxLength={1500} placeholder="Anything you&apos;d like us to know?"/></label>{error&&<p className={styles.pilotError} role="alert">{error}</p>}<button className={styles.pilotSubmit} disabled={busy}>{busy?"Sending…":"Request access →"}</button></form>}</div>
    </section>
    <section className={styles.pilotBenefits}><div><span>LESS ADMIN.</span><p>Automate the repetitive work behind running club leagues.</p></div><div><span>BETTER FOR PLAYERS.</span><p>One clear place for fixtures, results and standings.</p></div><div><span>BUILT FOR PADEL.</span><p>Designed around how modern padel clubs actually operate.</p></div></section>
    <footer className={styles.pilotFooter}><RalloraLogo variant="light" width={132}/><span>© {new Date().getFullYear()} Rallora</span></footer>
  </main>;
}
