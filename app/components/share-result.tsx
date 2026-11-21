"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {createClient} from "@/lib/supabase";
import {scoreSets} from "@/lib/leagues/scores";
import {ARTWORK_SIZES,createArtwork,type ArtworkSize,type ArtworkStyle,type StudioMatch} from "@/lib/social/studio";
import {downloadArtwork,loadArtworkLogo} from "@/lib/social/browser";
import styles from "./share-result.module.css";

/** Shares the public result, not a claim that the visitor played in it. */
export default function ShareResult({club,match}:{club:{id:string;slug:string;name:string;primary_color:string|null};match:StudioMatch}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const supabase=useMemo(()=>createClient(),[]);
  const [open,setOpen]=useState(false),[size,setSize]=useState<ArtworkSize>("square");
  const [frame,setFrame]=useState<ArtworkStyle>("court"),[logo,setLogo]=useState("");
  const [reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState("");
  useEffect(()=>{if(!open)return;let active=true;loadArtworkLogo().then(data=>{if(active)setLogo(data)}).catch(()=>{if(active)setFeedback("Brand artwork could not load. Close and reopen to try again.")});return()=>{active=false}},[open]);
  const artwork=createArtwork({club:club.name,accent:club.primary_color??"#00B0FE",title:`${match.division} · Match result`,body:"",size,style:frame,matches:[match],logoData:logo});
  const caption=`${club.name} · ${match.season}\n${match.home} vs ${match.away}\n${match.score}\nRound ${match.week} · ${match.division}`;
  async function handoff(action:"graphic"|"caption") {
    if(busy||!reviewed)return;setBusy(true);setFeedback("");
    try {
      // Only public columns, using the normal visitor session and existing RLS.
      const [result,fixture,season]=await Promise.all([
        supabase.from("results").select("fixture_id,home_score,away_score,status").eq("fixture_id",match.id).in("status",["confirmed","admin_override"]).maybeSingle(),
        supabase.from("fixtures").select("id,season_id,status,available_from,home_player_names,away_player_names").eq("id",match.id).eq("season_id",match.seasonId).or(`available_from.is.null,available_from.lte.${new Date().toISOString().slice(0,10)}`).maybeSingle(),
        supabase.from("seasons").select("id").eq("id",match.seasonId).eq("club_id",club.id).in("status",["active","completed"]).maybeSingle(),
      ]);
      if(result.error||fixture.error||season.error)throw new Error("Could not verify this result. Please try again.");
      const home=fixture.data?.home_player_names?.filter(Boolean).join(" / ");
      const away=fixture.data?.away_player_names?.filter(Boolean).join(" / ");
      if(!fixture.data||!season.data||fixture.data.status==="cancelled"||!result.data||
        (home&&home!==match.home)||(away&&away!==match.away)||
        (scoreSets(result.data.home_score).join("  ")||"–")!==match.homeScore||
        (scoreSets(result.data.away_score).join("  ")||"–")!==match.awayScore)
        throw new Error("This result has changed or is no longer available. Refresh the league page before sharing.");
      if(action==="graphic")await downloadArtwork(artwork.svg,ARTWORK_SIZES[size].height,`rallora-${club.slug}-result-${size}.png`);
      else {
        const url=new URL(club.slug==="gsm-padel"?"/clubs/gsm-padel/overview":`/clubs/${encodeURIComponent(club.slug)}`,window.location.origin);
        url.searchParams.set("view","results");url.searchParams.set("season",match.seasonId);
        await navigator.clipboard.writeText(`${caption}\n\n${url}`);
      }
      setFeedback(action==="graphic"?"Graphic downloaded. Copy the caption to share alongside it.":"Caption copied. Paste it into your social post.");
    } catch(error){setReviewed(false);setFeedback(error instanceof Error?error.message:"Could not prepare this result.");}
    finally{setBusy(false)}
  }
  return <><button className={styles.open} type="button" onClick={()=>{setOpen(true);setReviewed(false);setFeedback("");dialog.current?.showModal();}}>Share result ↗</button>
    <dialog ref={dialog} className={styles.dialog} onClose={()=>setOpen(false)} aria-labelledby={`share-${match.id}`}>
      <div className={styles.heading}><div><small>RALLORA · PLAYER SHARING</small><h2 id={`share-${match.id}`}>Share this result</h2></div><button type="button" aria-label="Close result sharing" onClick={()=>dialog.current?.close()}>✕</button></div>
      <p>Choose a frame, download your graphic and copy the caption. You decide where to post.</p>
      <div className={styles.controls}><label>Frame<select value={frame} onChange={e=>{setFrame(e.target.value as ArtworkStyle);setReviewed(false)}}><option value="court">Night court</option><option value="editorial">Club editorial</option><option value="minimal">Clean line</option></select></label>
        <label>Size<select value={size} onChange={e=>{setSize(e.target.value as ArtworkSize);setReviewed(false)}}>{Object.entries(ARTWORK_SIZES).map(([key,value])=><option value={key} key={key}>{value.label}</option>)}</select></label></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {open&&<img className={styles.artwork} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(artwork.svg)}`} alt={`Result graphic: ${match.home} versus ${match.away}`}/>}
      <p className={styles.caption}>{caption}</p>
      <label className={styles.review}><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I’ve checked the result and that it’s appropriate to share the named players.</label>
      <div className={styles.actions}><button type="button" disabled={!reviewed||!logo||busy} onClick={()=>void handoff("graphic")}>{busy?"Checking result…":"Download graphic"}</button><button type="button" disabled={!reviewed||busy} onClick={()=>void handoff("caption")}>Copy caption</button></div>
      {feedback&&<p role="status">{feedback}</p>}
    </dialog></>;
}
