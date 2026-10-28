"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {createClient} from "@/lib/supabase";
import type {EditableSeason} from "./club-editor";
import styles from "./editor.module.css";

type PoolPlayer = {id:string;season_id:string;player_name:string;playtomic_rating:number|null;preferred_level:string|null;availability:string|null};
type Team = EditableSeason["divisions"][number]["teams"][number];
type Movement = {action:"swap"|"add"|"standby";season:EditableSeason;divisionId:string;team:Team;slot:1|2};
const titles = {swap:"Swap Players",add:"Add from Standby",standby:"Move to Standby"};
function playerName(team:Team,slot:1|2) {return (slot===1?team.player_one_name:team.player_two_name)||"Vacant place";}

export default function PlayerManagement({clubId,seasons,onSaved}:{clubId:string;seasons:EditableSeason[];onSaved:()=>void}) {
  const supabase=useMemo(()=>createClient(),[]);
  const dialog=useRef<HTMLDialogElement>(null);
  const [movement,setMovement]=useState<Movement|null>(null);
  const [pool,setPool]=useState<PoolPlayer[]>([]);
  const [poolId,setPoolId]=useState("");
  const [otherId,setOtherId]=useState("");
  const [otherSlot,setOtherSlot]=useState<1|2>(1);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [reviewed,setReviewed]=useState(false);
  const [poolFailed,setPoolFailed]=useState(false);
  const season=movement?.season;
  const peers=season?.divisions.find(d=>d.id===movement?.divisionId)?.teams.filter(t=>t.id!==movement?.team.id)??[];
  const other=peers.find(t=>t.id===otherId);
  const chosen=pool.find(p=>p.id===poolId);
  const cycleIds=new Set<string>();
  let cycle=season;
  while(cycle&&!cycleIds.has(cycle.id)){cycleIds.add(cycle.id);cycle=seasons.find(s=>s.id===cycle?.previous_season_id);}
  const eligible=pool.filter(p=>cycleIds.has(p.season_id));

  useEffect(()=>{
    if(!movement)return;
    dialog.current?.showModal();
    if(movement.action!=="add")return;
    let alive=true;
    void (async()=>{
      try {
        const reply=await supabase.from("rallora_player_pools").select("id,season_id,player_name,playtomic_rating,preferred_level,availability")
          .eq("club_id",clubId).eq("pool_type","standby").eq("status","available").order("created_at");
        if(reply.error)throw reply.error;
        if(alive)setPool(reply.data??[]);
      }catch(e){if(alive){setPoolFailed(true);setError(e instanceof Error?e.message:"Standby players could not be loaded. Close and try again.");}}
      finally{if(alive)setLoading(false);}
    })();
    return()=>{alive=false;};
  },[movement,clubId,supabase]);

  function open(next:Movement){setError("");setPool([]);setPoolId("");setOtherId("");setOtherSlot(1);setReviewed(false);setPoolFailed(false);setLoading(next.action==="add");setMovement(next);}
  function close(){if(busy)return;dialog.current?.close();setMovement(null);}
  async function confirm(){
    if(!movement||busy||!reviewed)return;
    setBusy(true);setError("");
    try {
      const reply=await supabase.rpc("rallora_manage_players",{
        p_action:movement.action,p_team_id:movement.team.id,p_slot:movement.slot,p_expected_version:movement.team.roster_version,
        p_other_team_id:other?.id??null,p_other_slot:movement.action==="swap"?otherSlot:null,p_other_version:other?.roster_version??null,
        p_pool_id:movement.action==="add"?poolId:null,
      });
      if(reply.error)throw reply.error;
      setNotice(`${titles[movement.action]} completed. ${movement.action==="standby"?"This pairing is incomplete: add a standby player before its next match.":"Review captain access and any existing court arrangements with the affected players."}`);
      dialog.current?.close();setMovement(null);onSaved();
    }catch(e){setError(e instanceof Error?e.message:typeof e==="object"&&e&&"message" in e?String(e.message):"The movement could not be saved. Refresh the rosters and try again.");}
    finally{setBusy(false);}
  }
  return <section className={styles.wide}>
    <span className={styles.eyebrow}>PLAYERS &amp; PAIRINGS</span><h3>League pairings</h3>
    <p>Swap players within a division, add standby players or return a player to standby. Recorded matches retain their saved player names.</p>
    {notice&&<p className={styles.replacePanel} role="status">{notice}</p>}
    {seasons.map(s=>s.divisions.map(d=><section key={d.id} className={styles.pairingGroup}>
      <h4>{s.name} · {d.name}</h4>
      {d.teams.map(t=><article key={t.id} className={styles.pairingRow}>
        <div><strong>{[t.player_one_name,t.player_two_name].filter(Boolean).join(" / ")||t.name}</strong><span>{s.status}{(!t.player_one_name||!t.player_two_name)&&" · Incomplete pairing"}</span></div>
        <div className={`${styles.pairingPlayers} ${styles.movementPlayers}`}>{([1,2] as const).map(slot=><div key={slot}>
          <span>Player {slot}</span><strong>{playerName(t,slot)}</strong>
          <small>Playtomic rating {(slot===1?t.player_one_rating:t.player_two_rating)?.toFixed(2)??"not provided"}</small>
          {['draft','active'].includes(s.status)&&!seasons.some(child=>child.previous_season_id===s.id)&&<div className={styles.movementActions}>
            {t[slot===1?'player_one_name':'player_two_name']&&<button type="button" onClick={()=>open({action:"swap",season:s,divisionId:d.id,team:t,slot})}>Swap Players</button>}
            <button type="button" onClick={()=>open({action:"add",season:s,divisionId:d.id,team:t,slot})}>Add from Standby</button>
            {t[slot===1?'player_one_name':'player_two_name']&&<button type="button" onClick={()=>open({action:"standby",season:s,divisionId:d.id,team:t,slot})}>Move to Standby</button>}
          </div>}
        </div>)}</div>
      </article>)}
    </section>))}
    <dialog ref={dialog} className={styles.movementDialog} aria-labelledby="movement-title" onCancel={e=>{if(busy)e.preventDefault();else setMovement(null);}}>
      {movement&&<form onSubmit={e=>{e.preventDefault();void confirm();}}>
        <h3 id="movement-title">{titles[movement.action]}</h3><p>{movement.season.name} · {movement.team.name} · Player {movement.slot}: <strong>{playerName(movement.team,movement.slot)}</strong></p>
        {movement.action==="swap"&&<><label>Other pairing in this division<select value={otherId} onChange={e=>{setOtherId(e.target.value);setReviewed(false);}} disabled={busy} required><option value="">Choose pairing</option>{peers.map(t=><option key={t.id} value={t.id}>{playerName(t,1)} / {playerName(t,2)}</option>)}</select></label>
          <label>Player to exchange<select value={otherSlot} onChange={e=>{setOtherSlot(Number(e.target.value) as 1|2);setReviewed(false);}} disabled={busy||!other}>{([1,2] as const).map(slot=><option key={slot} value={slot} disabled={!other||(slot===1?!other.player_one_name:!other.player_two_name)}>{other?playerName(other,slot):`Player ${slot}`}</option>)}</select></label>
          {other&&<p>{playerName(movement.team,movement.slot)} → {other.name}<br/>{playerName(other,otherSlot)} → {movement.team.name}</p>}
          {!peers.length&&<p>No other pairings are available in this division.</p>}</>}
        {movement.action==="add"&&<><label>Standby player<select required disabled={busy||loading||poolFailed} value={poolId} onChange={e=>{setPoolId(e.target.value);setReviewed(false);}}><option value="">{loading?"Loading standby players…":"Choose standby player"}</option>{eligible.map(p=><option value={p.id} key={p.id}>{p.player_name}{p.playtomic_rating!=null?` · Rating ${p.playtomic_rating}`:""}{p.preferred_level?` · ${p.preferred_level}`:""}</option>)}</select></label>
          {!loading&&!poolFailed&&!eligible.length&&<p>No available standby players for this competition. Review Registrations → Standby, then reopen this action.</p>}
          {chosen?.availability&&<p>Availability: {chosen.availability}</p>}
          <p>{chosen?.player_name??"Selected standby player"} will fill Player {movement.slot}.{movement.team[movement.slot===1?'player_one_name':'player_two_name']&&` ${playerName(movement.team,movement.slot)} will move to standby as part of the same operation.`}</p></>}
        {movement.action==="standby"&&<p role="note">This leaves the pairing incomplete and may remove its captain access. Existing fixtures and bookings remain scheduled. Add a standby player before its next match.</p>}
        <p>Scores and league places stay with their teams. Check the club’s rating and registration rules. Players being moved must have claimed their Rallora accounts.</p>
        <label className={styles.movementReview}><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)} disabled={busy}/>I have reviewed the destinations, eligibility and any upcoming fixtures.</label>
        {error&&<p role="alert">{error}</p>}
        <div className={styles.pairingActions}><button type="submit" disabled={busy||loading||!reviewed||(movement.action==="swap"&&(!other||!other[otherSlot===1?'player_one_name':'player_two_name']))||(movement.action==="add"&&(!chosen||poolFailed))}>{busy?"Saving…":`Confirm ${titles[movement.action]}`}</button><button type="button" disabled={busy} className={styles.secondaryButton} onClick={close}>Cancel</button></div>
      </form>}
    </dialog>
  </section>;
}
