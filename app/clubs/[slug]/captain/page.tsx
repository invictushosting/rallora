"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { captainResultState, OFFICIAL_RESULT_STATUSES, type CaptainSubmission, type OfficialResult } from "@/lib/leagues/result-workflow";
import styles from "./captain.module.css";

type Team = { id:string; name:string; player_one_name:string|null; player_two_name:string|null;
  player_one_rating:number|null; player_two_rating:number|null; season:{name:string;status:string;created_at:string} };
type Fixture = { id:string; home_team_id:string; away_team_id:string; play_by:string; status:string };

export default function CaptainCentre() {
  const params=useParams(), slug=typeof params.slug==="string"?params.slug:"";
  const supabase=useMemo(()=>createClient(),[]);
  const [team,setTeam]=useState<Team|null>(null), [captainTeams,setCaptainTeams]=useState<Team[]>([]);
  const [selectedId,setSelectedId]=useState(""), [viewerId,setViewerId]=useState("");
  const [labels,setLabels]=useState<Record<string,string>>({}), [fixtures,setFixtures]=useState<Fixture[]>([]);
  const [submissions,setSubmissions]=useState<CaptainSubmission[]>([]), [results,setResults]=useState<OfficialResult[]>([]);
  const [notice,setNotice]=useState("Loading captain access…"), [busy,setBusy]=useState("");
  const loadVersion=useRef(0);

  const load=useCallback(async()=>{
    const version=++loadVersion.current;
    try {
      const auth=await supabase.auth.getUser();
      if(auth.error) throw auth.error;
      const user=auth.data.user;
      if(!user){setTeam(null);setCaptainTeams([]);setFixtures([]);setNotice("Sign in with your captain account.");return;}
      const club=await supabase.from("clubs").select("id").eq("slug",slug).maybeSingle();
      if(club.error) throw club.error;
      if(!club.data) throw new Error("Club not found.");
      const roster=await supabase.from("rallora_team_roster_memberships")
        .select("team_id,teams(id,name,player_one_name,player_two_name,player_one_rating,player_two_rating),seasons(name,status,created_at)")
        .eq("club_id",club.data.id).eq("player_user_id",user.id).eq("role","captain");
      if(roster.error) throw roster.error;
      const available=(roster.data??[]).filter(row=>row.teams&&row.seasons)
        .map(row=>({...row.teams as unknown as Omit<Team,"season">,season:row.seasons as unknown as Team["season"]}))
        .sort((a,b)=>Number(b.season.status==="active")-Number(a.season.status==="active")||b.season.created_at.localeCompare(a.season.created_at));
      const chosen=available.find(item=>item.id===selectedId)??available[0];
      let rows:Fixture[]=[], names:Record<string,string>={}, submitted:CaptainSubmission[]=[], official:OfficialResult[]=[];
      if(chosen&&chosen.season.status!=="draft") {
        const reply=await supabase.from("fixtures").select("id,home_team_id,away_team_id,play_by,status")
          .or(`home_team_id.eq.${chosen.id},away_team_id.eq.${chosen.id}`).order("play_by");
        if(reply.error) throw reply.error;
        rows=(reply.data??[]).filter(item=>item.status!=="cancelled");
        if(rows.length) {
          const teamIds=[...new Set(rows.flatMap(item=>[item.home_team_id,item.away_team_id]))];
          const ids=rows.map(item=>item.id);
          const [pairings,scores,confirmed]=await Promise.all([
            supabase.from("teams").select("id,name,player_one_name,player_two_name").in("id",teamIds),
            supabase.from("result_submissions").select("id,fixture_id,submitting_team_id,submitted_by_user_id,home_score,away_score,notes,dispute_note,status,updated_at").in("fixture_id",ids).order("updated_at",{ascending:false}),
            supabase.from("results").select("fixture_id,home_score,away_score,status").in("fixture_id",ids).in("status",OFFICIAL_RESULT_STATUSES),
          ]);
          if(pairings.error) throw pairings.error;
          if(scores.error) throw scores.error;
          if(confirmed.error) throw confirmed.error;
          names=Object.fromEntries((pairings.data??[]).map(item=>[item.id,[item.player_one_name,item.player_two_name].filter(Boolean).join(" / ")||item.name||"Players"]));
          submitted=(scores.data??[]) as CaptainSubmission[]; official=(confirmed.data??[]) as OfficialResult[];
        }
      }
      if(version!==loadVersion.current) return;
      setViewerId(user.id);setCaptainTeams(available);setTeam(chosen??null);setFixtures(rows);setLabels(names);setSubmissions(submitted);setResults(official);
      setNotice(!chosen?"Your account is not assigned as a captain for this club yet. If your team was just approved, refresh this page or contact the organiser."
        :chosen.season.status==="draft"?"This cycle is being prepared. Fixtures become available when the organiser activates it."
        :chosen.season.status==="completed"?"This cycle is complete. Its results are shown for reference.":"");
    } catch(error) {
      if(version===loadVersion.current) {setFixtures([]);setNotice(error instanceof Error?error.message:"Captain access could not be loaded. Please refresh and try again.");}
    }
  },[slug,supabase,selectedId]);
  useEffect(()=>{if(slug)void load();return()=>{loadVersion.current++;};},[slug,load]);

  async function submit(event:FormEvent<HTMLFormElement>,fixture:Fixture) {
    event.preventDefault();if(busy)return;
    const fields=new FormData(event.currentTarget),home=String(fields.get("home")??"").trim(),away=String(fields.get("away")??"").trim(),winner=String(fields.get("winner")??"");
    if(!home||!away||!winner){setNotice("Enter both scores and choose the winning pairing.");return;}
    if(!window.confirm(`Submit ${labels[fixture.home_team_id]} ${home} – ${away} ${labels[fixture.away_team_id]}? The opposing captain will be asked to confirm it.`))return;
    setBusy(fixture.id);
    try {
      const reply=await supabase.rpc("rallora_submit_captain_result",{p_fixture_id:fixture.id,p_home_score:home,p_away_score:away,p_winner_team_id:winner,p_notes:String(fields.get("notes")??"")});
      if(reply.error)throw reply.error;
      await load();
    } catch(error){setNotice(error&&typeof error==="object"&&"message" in error?String(error.message):"The result could not be submitted. Please try again.");}
    finally{setBusy("");}
  }

  async function review(id:string,decision:"confirm"|"dispute") {
    if(busy)return;
    let note="";
    if(decision==="dispute") {
      const answer=window.prompt("Tell the club organiser what is wrong with this result. Include the correct score or any useful details.");
      if(answer===null)return;
      note=answer.trim();if(!note){setNotice("Please add some information so the club can review the dispute.");return;}
    } else if(!window.confirm("Confirm this result as correct? It will become the official result and update the standings."))return;
    setBusy(id);
    try {
      const reply=decision==="dispute"?await supabase.rpc("rallora_dispute_captain_result",{p_submission_id:id,p_note:note})
        :await supabase.rpc("rallora_review_captain_result",{p_submission_id:id,p_decision:decision});
      if(reply.error)throw reply.error;
      await load();
    } catch(error){setNotice(error&&typeof error==="object"&&"message" in error?String(error.message):"The result could not be reviewed. Please try again.");}
    finally{setBusy("");}
  }

  const fixtureCards=fixtures.map(fixture=>({fixture,...captainResultState(fixture,team?.id??"",viewerId,team?.season.status,submissions,results)}))
    .sort((a,b)=>Number(b.action)-Number(a.action)||a.fixture.play_by.localeCompare(b.fixture.play_by));
  const actionCount=fixtureCards.filter(item=>item.action).length;
  return <main className={styles.page}><div className={styles.shell}>
    <header><Link href={`/clubs/${slug}`}>← Club hub</Link><strong>RALLORA · CAPTAIN</strong></header>
    <section className={styles.hero}><div className={styles.heroTop}><span>CAPTAIN CENTRE</span>{team&&<strong className={styles.actionBadge}>{actionCount} action{actionCount===1?"":"s"}</strong>}</div>
      <h1>{team?[team.player_one_name,team.player_two_name].filter(Boolean).join(" / ")||team.name:"Your pairing"}</h1>
      <p>Your match centre for fixtures, scores and result confirmation.</p>
      {team&&<div className={styles.ratingStrip}><span>PLAYTOMIC</span><strong>{team.player_one_name} {team.player_one_rating?.toFixed(2)??"–"}</strong><strong>{team.player_two_name} {team.player_two_rating?.toFixed(2)??"–"}</strong></div>}
      {captainTeams.length>1&&<label>Captain pairing<select disabled={Boolean(busy)} value={team?.id??""} onChange={event=>{setSelectedId(event.target.value);setFixtures([]);setNotice("Loading captain access…");}}>{captainTeams.map(item=><option key={item.id} value={item.id}>{item.season.name} · {[item.player_one_name,item.player_two_name].filter(Boolean).join(" / ")||item.name}</option>)}</select></label>}
    </section>
    {notice&&<p className={styles.notice} role="status">{notice}</p>}
    {!team&&<Link href={`/account?club=${encodeURIComponent(slug)}&return=captain`}>Open your account →</Link>}
    {team&&!notice&&fixtures.length===0&&<p className={styles.notice}>Your captain access is active. There are no fixtures available for your pairing yet.</p>}
    {team&&fixtures.length>0&&<section className={styles.actionCentre}><div><span>NEXT UP</span><h2>{actionCount?`${actionCount} match${actionCount===1?"":"es"} need your attention`:"You’re all caught up"}</h2></div><p>{actionCount?"Submit scores or review an opponent result below.":"No captain actions are waiting right now."}</p></section>}
    <section className={styles.grid}>{fixtureCards.map(({fixture,official,submission,confirmed,needsReview,needsSubmit,action,label})=>{
      const score=official??submission;
      return <article className={`${styles.card} ${action?styles.actionCard:""}`} key={fixture.id}>
        <small>{label} · PLAY BY {new Date(`${fixture.play_by}T00:00:00`).toLocaleDateString("en-GB")}</small>
        <h2>{labels[fixture.home_team_id]??"Home"} <span>vs</span> {labels[fixture.away_team_id]??"Away"}</h2>
        {needsSubmit?<form onSubmit={event=>void submit(event,fixture)}>
          <div><label>Home score<input name="home" required maxLength={100} autoComplete="off" placeholder="e.g. 6, 6"/></label><label>Away score<input name="away" required maxLength={100} autoComplete="off" placeholder="e.g. 4, 3"/></label></div>
          <label>Winner<select name="winner" required><option value="">Choose winner</option><option value={fixture.home_team_id}>{labels[fixture.home_team_id]}</option><option value={fixture.away_team_id}>{labels[fixture.away_team_id]}</option></select></label>
          <label>Notes<input name="notes" maxLength={1000}/></label><p className={styles.helper}>Enter each pairing’s games in set order, separated by commas: home 6, 6 and away 4, 3 means a 6–4, 6–3 win. Choose the winner, then submit for opponent confirmation.</p>
          <button disabled={Boolean(busy)}>{busy===fixture.id?"Submitting…":"Review & submit result"}</button>
        </form>:<div className={styles.result}>
          {score?<strong className={styles.finalResult}><small>{confirmed?"FINAL":"SUBMITTED"}</small>{score.home_score} <em>:</em> {score.away_score}</strong>:<strong>{confirmed?"Result confirmed":"With your organiser"}</strong>}
          <span>{confirmed?"Official result":label.toLowerCase()}</span>
          {needsReview&&submission&&<div><button disabled={Boolean(busy)} onClick={()=>void review(submission.id,"confirm")}>Confirm result</button><button disabled={Boolean(busy)} onClick={()=>void review(submission.id,"dispute")}>Dispute</button></div>}
          {!confirmed&&submission?.dispute_note&&<p className={styles.helper}>{submission.dispute_note}</p>}
        </div>}
      </article>;
    })}</section>
  </div></main>;
}
