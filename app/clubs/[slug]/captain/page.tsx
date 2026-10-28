"use client";

import {fixturePlayerLabel} from "@/lib/fixture-rosters";
import type {FixtureArrangement} from "./fixture-booking";
import { MessageCircle } from "lucide-react";
import BackLink from "@/app/components/back-link";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { captainResultState, OFFICIAL_RESULT_STATUSES, type CaptainSubmission, type OfficialResult } from "@/lib/leagues/result-workflow";
import styles from "./captain.module.css";

type Team = { id:string; name:string; player_one_name:string|null; player_two_name:string|null;
  player_one_rating:number|null; player_two_rating:number|null; season:{name:string;status:string;created_at:string} };
type Fixture = { id:string; home_team_id:string; away_team_id:string; play_by:string; status:string;home_player_names:(string|null)[]|null;away_player_names:(string|null)[]|null };

export default function CaptainCentre() {
  const params=useParams(), slug=typeof params.slug==="string"?params.slug:"";
  const supabase=useMemo(()=>createClient(),[]);
  const [team,setTeam]=useState<Team|null>(null), [captainTeams,setCaptainTeams]=useState<Team[]>([]);
  const [selectedId,setSelectedId]=useState(""), [viewerId,setViewerId]=useState("");
  const [pairingSearch,setPairingSearch]=useState("");
  const [platformAdmin,setPlatformAdmin]=useState(false), [loading,setLoading]=useState(true);
  const [labels,setLabels]=useState<Record<string,string>>({}), [fixtures,setFixtures]=useState<Fixture[]>([]);
  const [submissions,setSubmissions]=useState<CaptainSubmission[]>([]), [results,setResults]=useState<OfficialResult[]>([]);
  const [notice,setNotice]=useState("Loading captain access…"), [busy,setBusy]=useState("");
  const loadVersion=useRef(0);
  const [unread,setUnread]=useState<Record<string,number>>({});
  const [arrangements,setArrangements]=useState<FixtureArrangement[]>([]);

  const load=useCallback(async()=>{
    const version=++loadVersion.current;
    setLoading(true);
    try {
      const auth=await supabase.auth.getUser();
      if(auth.error && auth.error.name!=="AuthSessionMissingError") throw auth.error;
      const user=auth.data.user;
      if(version!==loadVersion.current)return;
      if(!user){setPlatformAdmin(false);setViewerId("");setTeam(null);setCaptainTeams([]);setFixtures([]);setSubmissions([]);setResults([]);setNotice("Sign in with your captain account to view your pairing and fixtures.");return;}
      const club=await supabase.from("clubs").select("id").eq("slug",slug).maybeSingle();
      if(club.error) throw club.error;
      if(!club.data) throw new Error("Club not found.");
      const access=await supabase.rpc("rallora_is_platform_admin");
      if(access.error)throw access.error;
      const isAdmin=access.data===true;
      let available:Team[]=[];
      if(isAdmin){
        // Use the real club roster, including pairings without an assigned captain.
        // RLS still checks the signed-in administrator on every query.
        const seasons=await supabase.from("seasons").select("id,name,status,created_at").eq("club_id",club.data.id);
        if(seasons.error)throw seasons.error;
        if(seasons.data?.length){
          const divisions=await supabase.from("divisions").select("season_id,teams(id,name,player_one_name,player_two_name,player_one_rating,player_two_rating)").in("season_id",seasons.data.map(s=>s.id));
          if(divisions.error)throw divisions.error;
          const seasonMap=new Map(seasons.data.map(s=>[s.id,s]));
          available=(divisions.data??[]).flatMap(d=>{
            const season=seasonMap.get(d.season_id);
            return season?(d.teams??[]).map(t=>({...t,season})):[];
          });
        }
      }else{
        const roster=await supabase.from("rallora_team_roster_memberships")
        .select("team_id,teams(id,name,player_one_name,player_two_name,player_one_rating,player_two_rating),seasons(name,status,created_at)")
        .eq("club_id",club.data.id).eq("player_user_id",user.id).eq("role","captain");
      if(roster.error) throw roster.error;
        available=(roster.data??[]).filter(row=>row.teams&&row.seasons)
          .map(row=>({...row.teams as unknown as Omit<Team,"season">,season:row.seasons as unknown as Team["season"]}));
      }
      available.sort((a,b)=>Number(b.season.status==="active")-Number(a.season.status==="active")||b.season.created_at.localeCompare(a.season.created_at)||a.id.localeCompare(b.id));
      const chosen=available.find(item=>item.id===selectedId)??available[0];
      let booked:FixtureArrangement[]=[];
      let rows:Fixture[]=[], names:Record<string,string>={}, submitted:CaptainSubmission[]=[], official:OfficialResult[]=[];
      if(chosen&&(isAdmin||chosen.season.status!=="draft")) {
        const reply=await supabase.from("fixtures").select("id,home_team_id,away_team_id,play_by,status,home_player_names,away_player_names")
          .or(`home_team_id.eq.${chosen.id},away_team_id.eq.${chosen.id}`).order("play_by");
        if(reply.error) throw reply.error;
        rows=(reply.data??[]).filter(item=>isAdmin||item.status!=="cancelled");
        if(rows.length) {
          const teamIds=[...new Set(rows.flatMap(item=>[item.home_team_id,item.away_team_id]))];
          const ids=rows.map(item=>item.id);
          const [bookings,pairings,scores,confirmed]=await Promise.all([
            supabase.from("rallora_fixture_arrangements").select("fixture_id,starts_at,ends_at,court").in("fixture_id",ids),
            supabase.from("teams").select("id,name,player_one_name,player_two_name").in("id",teamIds),
            supabase.from("result_submissions").select("id,fixture_id,submitting_team_id,submitted_by_user_id,home_score,away_score,notes,dispute_note,status,updated_at").in("fixture_id",ids).order("updated_at",{ascending:false}),
            supabase.from("results").select("fixture_id,home_score,away_score,status").in("fixture_id",ids).in("status",OFFICIAL_RESULT_STATUSES),
          ]);
          if(bookings.error) throw bookings.error;
          booked=(bookings.data??[]) as FixtureArrangement[];
          if(pairings.error) throw pairings.error;
          if(scores.error) throw scores.error;
          if(confirmed.error) throw confirmed.error;
          names=Object.fromEntries((pairings.data??[]).map(item=>[item.id,[item.player_one_name,item.player_two_name].filter(Boolean).join(" / ")||item.name||"Players"]));
          submitted=(scores.data??[]) as CaptainSubmission[]; official=(confirmed.data??[]) as OfficialResult[];
        }
      }
      if(version!==loadVersion.current) return;
      const threadSummary=await supabase.rpc("rallora_fixture_conversation_summaries",{p_club_id:club.data.id});
      if(version!==loadVersion.current)return;
      setUnread(Object.fromEntries(((threadSummary.data??[]) as {fixture_id:string;unread_count:number}[]).map(row=>[row.fixture_id,Number(row.unread_count)])));
      setPlatformAdmin(isAdmin);setArrangements(booked);setViewerId(user.id);setCaptainTeams(available);setTeam(chosen??null);setFixtures(rows);setLabels(names);setSubmissions(submitted);setResults(official);
      setNotice(!chosen?(isAdmin?"This club has no pairings yet. Create or approve teams in club admin to inspect their captain view.":"Your account is not assigned as a captain for this club yet. If your team was just approved, refresh this page or contact the organiser.")
        :chosen.season.status==="draft"?"This cycle is being prepared. Fixtures become available when the organiser activates it."
        :chosen.season.status==="completed"?"This cycle is complete. Its results are shown for reference.":"");
    } catch(error) {
      if(version===loadVersion.current) {setPlatformAdmin(false);setTeam(null);setCaptainTeams([]);setFixtures([]);setNotice(error instanceof Error?error.message:"Captain access could not be loaded. Please refresh and try again.");}
    } finally {
      if(version===loadVersion.current)setLoading(false);
    }
  },[slug,supabase,selectedId]);
  useEffect(()=>{
    if(slug)void load();
    let timer:ReturnType<typeof setTimeout>|undefined;
    const {data}=supabase.auth.onAuthStateChange(()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>void load(),0);});
    return()=>{loadVersion.current++;if(timer)clearTimeout(timer);data.subscription.unsubscribe();};
  },[slug,load,supabase]);

  async function submit(event:FormEvent<HTMLFormElement>,fixture:Fixture) {
    event.preventDefault();if(busy||loading||!team)return;
    const fields=new FormData(event.currentTarget),home=String(fields.get("home")??"").trim(),away=String(fields.get("away")??"").trim(),winner=String(fields.get("winner")??"");
    if(!home||!away||!winner){setNotice("Enter both scores and choose the winning pairing.");return;}
    if(!window.confirm(`Submit ${fixturePlayerLabel(fixture,fixture.home_team_id,labels[fixture.home_team_id]??"Players")} ${home} – ${away} ${fixturePlayerLabel(fixture,fixture.away_team_id,labels[fixture.away_team_id]??"Players")}? The opposing captain will be asked to confirm it.`))return;
    setBusy(fixture.id);
    try {
      const args={p_fixture_id:fixture.id,p_home_score:home,p_away_score:away,p_winner_team_id:winner,p_notes:String(fields.get("notes")??"")};
      const reply=platformAdmin
        ?await supabase.rpc("rallora_platform_submit_captain_result",{...args,p_team_id:team.id})
        :await supabase.rpc("rallora_submit_captain_result",args);
      if(reply.error)throw reply.error;
      await load();
    } catch(error){setNotice(error&&typeof error==="object"&&"message" in error?String(error.message):"The result could not be submitted. Please try again.");}
    finally{setBusy("");}
  }

  async function review(id:string,decision:"confirm"|"dispute") {
    if(busy||loading)return;
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

  const fixtureCards=(loading?[]:fixtures).map(fixture=>({fixture,...captainResultState(fixture,team?.id??"",viewerId,team?.season.status,submissions,results,platformAdmin)}))
    .sort((a,b)=>Number(b.action)-Number(a.action)||a.fixture.play_by.localeCompare(b.fixture.play_by));
  const actionCount=fixtureCards.filter(item=>item.action).length;
  const searchWords=pairingSearch.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matchingTeams=captainTeams.filter(item=>{
    const text=[item.player_one_name,item.player_two_name,item.name,item.season.name].filter(Boolean).join(" ").toLocaleLowerCase();
    return searchWords.every(word=>text.includes(word));
  });
  const selectedMatch=matchingTeams.some(item=>item.id===team?.id);
  return <main className={styles.page}><div className={styles.shell}>
    <header><BackLink href={`/clubs/${slug}`}>Back to club</BackLink><Link href={`/help/captain-access?club=${encodeURIComponent(slug)}`}>Captain guide</Link><strong>RALLORA · CAPTAIN</strong></header>
    <section className={styles.hero}><div className={styles.heroTop}><span>CAPTAIN CENTRE</span>{team&&<strong className={styles.actionBadge}>{actionCount} action{actionCount===1?"":"s"}</strong>}</div>
      <h1>{team?[team.player_one_name,team.player_two_name].filter(Boolean).join(" / ")||team.name:"Your pairing"}</h1>
      <p>Your match centre for fixtures, scores and result confirmation.</p>
      {team&&<div className={styles.ratingStrip}><span>PLAYTOMIC</span><strong>{team.player_one_name} {team.player_one_rating?.toFixed(2)??"–"}</strong><strong>{team.player_two_name} {team.player_two_rating?.toFixed(2)??"–"}</strong></div>}
      {platformAdmin&&<p className={styles.adminNotice}><strong>Super admin · View as captain</strong><br/>Choose any pairing to inspect its fixtures and captain actions. Saving bookings, submitting scores and reviewing results changes live club data under your admin account.</p>}
      {(platformAdmin&&captainTeams.length>0||captainTeams.length>1)&&<div className={styles.pairingPicker}>
        <label htmlFor="captain-pairing-search">Search players or leagues</label>
        <div className={styles.pairingSearch}>
          <input id="captain-pairing-search" type="search" autoComplete="off" placeholder="Type either player’s name or a league" value={pairingSearch} disabled={Boolean(busy)||loading} onChange={event=>setPairingSearch(event.target.value)} aria-describedby="captain-pairing-count"/>
          {pairingSearch&&<button type="button" disabled={Boolean(busy)||loading} onClick={()=>setPairingSearch("")}>Clear search</button>}
        </div>
        <p id="captain-pairing-count" className={styles.pairingCount} role="status">{matchingTeams.length?`${matchingTeams.length} of ${captainTeams.length} pairings shown. Choose a pairing below to view it.`:"No pairings match your search. Try another name or clear the search."}</p>
        <label htmlFor="captain-pairing">{platformAdmin?"View as captain · pairing":"Captain pairing"}</label>
        <select id="captain-pairing" disabled={Boolean(busy)||loading||matchingTeams.length===0} value={selectedMatch?team?.id??"":""} onChange={event=>{if(!event.target.value)return;setLoading(true);setSelectedId(event.target.value);setFixtures([]);setNotice("Loading captain access…");}}>
          {!selectedMatch&&<option value="" disabled>{matchingTeams.length?"Choose a matching pairing":"No matching pairings"}</option>}
          {matchingTeams.map(item=><option key={item.id} value={item.id}>{item.season.name} ({item.season.status}) · {[item.player_one_name,item.player_two_name].filter(Boolean).join(" / ")||item.name}</option>)}
        </select>
      </div>}
    </section>
    {notice&&<p className={styles.notice} role="status">{notice}</p>}
    {!loading&&!team&&<Link href={platformAdmin?`/clubs/${slug}/admin`:viewerId?`/account?club=${encodeURIComponent(slug)}&return=captain`:"/login"}>{platformAdmin?"Open club admin":viewerId?"Open your account":"Sign in to your captain account"} →</Link>}
    {!loading&&team&&!notice&&fixtures.length===0&&<p className={styles.notice}>There are no fixtures available for this pairing yet.</p>}
    {!loading&&team&&fixtures.length>0&&<section className={styles.actionCentre}><div><span>NEXT UP</span><h2>{actionCount?`${actionCount} match${actionCount===1?"":"es"} need your attention`:"You’re all caught up"}</h2></div><p>{actionCount?"Submit scores or review an opponent result below.":"No captain actions are waiting right now."}</p></section>}
    <section className={styles.grid}>{fixtureCards.map(({fixture,official,submission,confirmed,needsReview,needsSubmit,action,label})=>{
      const score=official??submission;
      const booking=arrangements.find(item=>item.fixture_id===fixture.id);
      return <article className={`${styles.card} ${action?styles.actionCard:""}`} key={fixture.id}>
        <small>{label} · PLAY BY {new Date(`${fixture.play_by}T00:00:00`).toLocaleDateString("en-GB")}</small>
        <h2>{fixturePlayerLabel(fixture,fixture.home_team_id,labels[fixture.home_team_id]??"Players")} <span>vs</span> {fixturePlayerLabel(fixture,fixture.away_team_id,labels[fixture.away_team_id]??"Players")}</h2>
        <div className={styles.matchActions}>
          <Link className={styles.matchLink} href={`/clubs/${slug}/matches/${fixture.id}`}><MessageCircle size={17} aria-hidden="true"/>{needsSubmit?"Arrange match":"Match chat"}{unread[fixture.id]>0&&<strong>{unread[fixture.id]} unread</strong>}</Link>
          <p className={styles.matchHint}>{booking?`Booked · ${new Date(booking.starts_at).toLocaleString("en-GB",{timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"})} UK time${booking.court?` · ${booking.court}`:""}`:needsSubmit?"Message opponents and agree a time.":"View messages and match arrangements."}</p>
        </div>
        {needsSubmit?<form onSubmit={event=>void submit(event,fixture)}>
          <h3 className={styles.resultHeading}>Submit result</h3>
          <div><label>Home score<input name="home" required maxLength={100} autoComplete="off" placeholder="e.g. 6, 6"/></label><label>Away score<input name="away" required maxLength={100} autoComplete="off" placeholder="e.g. 4, 3"/></label></div>
          <label>Winner<select name="winner" required><option value="">Choose winner</option><option value={fixture.home_team_id}>{fixturePlayerLabel(fixture,fixture.home_team_id,labels[fixture.home_team_id]??"Players")}</option><option value={fixture.away_team_id}>{fixturePlayerLabel(fixture,fixture.away_team_id,labels[fixture.away_team_id]??"Players")}</option></select></label>
          <label>Notes<input name="notes" maxLength={1000}/></label><p className={styles.helper}>Enter games in set order, e.g. home 6, 6 and away 4, 3. Your opponents will confirm the result.</p>
          <button disabled={Boolean(busy)}>{busy===fixture.id?"Submitting…":"Review & submit result"}</button>
        </form>:<div className={styles.result}>
          {score?<strong className={styles.finalResult}><small>{confirmed?"FINAL":"SUBMITTED"}</small>{score.home_score} <em>:</em> {score.away_score}</strong>:<strong>{label==="DRAFT"?"Cycle being prepared":label==="CANCELLED"?"Fixture cancelled":confirmed?"Result confirmed":"With your organiser"}</strong>}
          <span>{confirmed?"Official result":label.toLowerCase()}</span>
          {needsReview&&submission&&<div><button disabled={Boolean(busy)} onClick={()=>void review(submission.id,"confirm")}>Confirm result</button><button disabled={Boolean(busy)} onClick={()=>void review(submission.id,"dispute")}>Dispute</button></div>}
          {!confirmed&&submission?.dispute_note&&<p className={styles.helper}>{submission.dispute_note}</p>}
        </div>}
      </article>;
    })}</section>
  </div></main>;
}
