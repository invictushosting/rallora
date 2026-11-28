"use client";

import BackLink from "@/app/components/back-link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase";
import styles from "../admin.module.css";
import editorStyles from "../editor.module.css";

type Season = {id:string; name:string; status:string; league_format:string; previous_season_id:string|null; promotion_places:number; relegation_places:number};
type Division = {id:string; name:string; season_id:string};
type Team = {id:string; name:string; division_id:string; player_one_name:string|null; player_two_name:string|null};
type AffectedFixture = {fixture_id:string; status:string; play_by:string; opponent:string; booking_starts_at:string|null; decision:"bye"|"preserve"|"review"};
type Preview = {fixtures:AffectedFixture[]; snapshot:string};
type Withdrawal = {id:string; team_id:string; season_id:string; timing:string; reason:string; created_at:string; reinstated_at:string|null; fixture_ids:string[]};
type Movement = {division_id:string; promotion_places:number|null; relegation_places:number|null};
type MovementChange = {id:number; division_id:string; changed_at:string; previous_settings:[number|null,number|null]|null; new_settings:[number|null,number|null]};
type ClubData = {seasons:Season[]; divisions:Division[]; teams:Team[]; withdrawals:Withdrawal[]; movement:Movement[]; movementHistory:MovementChange[]};

function teamLabel(team:Team) {
  return [team.player_one_name,team.player_two_name].filter(Boolean).join(" / ") || team.name;
}

function dateTime(value:string) {
  return new Date(value).toLocaleString("en-GB",{timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"});
}

export default function TeamWithdrawals() {
  const {slug}=useParams<{slug:string}>();
  const supabase=useMemo(()=>createClient(),[]);
  const [data,setData]=useState<ClubData|null>(null);
  const [seasonId,setSeasonId]=useState("");
  const [divisionId,setDivisionId]=useState("");
  const [teamId,setTeamId]=useState("");
  const [timing,setTiming]=useState("now");
  const [reason,setReason]=useState("");
  const [notify,setNotify]=useState(false);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [loadError,setLoadError]=useState("");

  const load=useCallback(async()=>{
    const club=await supabase.from("clubs").select("id").eq("slug",slug).single();
    if(club.error||!club.data){setLoadError("Club unavailable.");return;}
    const clubId=club.data.id;
    const access=await supabase.rpc("rallora_can_manage_club",{p_club_id:clubId});
    if(access.error||!access.data){setLoadError("Sign in with a club administrator account to manage withdrawals.");return;}
    const [seasons,withdrawals,movement,movementHistory]=await Promise.all([
      supabase.from("seasons").select("id,name,status,league_format,previous_season_id,promotion_places,relegation_places").eq("club_id",clubId).order("created_at",{ascending:false}),
      supabase.from("rallora_team_withdrawals").select("id,team_id,season_id,timing,reason,created_at,reinstated_at,fixture_ids").eq("club_id",clubId).order("created_at",{ascending:false}),
      supabase.from("rallora_division_round_movement").select("division_id,promotion_places,relegation_places").eq("club_id",clubId),
      supabase.from("rallora_division_round_movement_history").select("id,division_id,changed_at,previous_settings,new_settings").eq("club_id",clubId).order("changed_at",{ascending:false}),
    ]);
    if(seasons.error||withdrawals.error||movement.error||movementHistory.error){setLoadError("We couldn’t load the team withdrawal records.");return;}
    const seasonRows=seasons.data??[];
    const divisions=seasonRows.length
      ? await supabase.from("divisions").select("id,name,season_id").in("season_id",seasonRows.map(item=>item.id)).order("sort_order")
      : {data:[],error:null};
    if(divisions.error){setLoadError("We couldn’t load this club’s divisions.");return;}
    const divisionRows=divisions.data??[];
    const teams=divisionRows.length
      ? await supabase.from("teams").select("id,name,division_id,player_one_name,player_two_name").in("division_id",divisionRows.map(item=>item.id)).order("name")
      : {data:[],error:null};
    if(teams.error){setLoadError("We couldn’t load this club’s teams.");return;}
    setLoadError("");
    setData({seasons:seasonRows,divisions:divisionRows,teams:teams.data??[],withdrawals:withdrawals.data??[],movement:movement.data??[],movementHistory:movementHistory.data??[]});
  },[slug,supabase]);

  useEffect(()=>{void load();},[load]);

  const season=data?.seasons.find(item=>item.id===seasonId);
  const rolling=season?.league_format==="promotion_relegation_cycles";
  const canChange=Boolean(season&&["draft","active"].includes(season.status)&&!data?.seasons.some(item=>item.previous_season_id===seasonId));
  const withdrawal=data?.withdrawals.find(item=>item.team_id===teamId&&!item.reinstated_at);
  const override=data?.movement.find(item=>item.division_id===divisionId);

  async function reviewFixtures() {
    setBusy(true);setPreview(null);setMessage("");
    const response=await supabase.rpc("rallora_preview_team_withdrawal",{p_team_id:teamId});
    if(response.error)setMessage(response.error.message);
    else setPreview(response.data as Preview);
    setBusy(false);
  }

  async function withdraw(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!preview||busy)return;
    setBusy(true);setMessage("");
    const response=await supabase.rpc("rallora_withdraw_team",{
      p_team_id:teamId,p_timing:timing,p_reason:reason.trim(),p_snapshot:preview.snapshot,p_notify:notify,
    });
    setPreview(null);
    if(response.error)setMessage(response.error.message);
    else {
      setReason("");
      setMessage(timing==="now"?"Team withdrawn. The affected outstanding fixtures are now byes.":"Withdrawal scheduled for the next round.");
      await load();
    }
    setBusy(false);
  }

  async function reinstate() {
    if(!withdrawal||!window.confirm("Reinstate this team? Eligible affected fixtures return to their previous status."))return;
    setBusy(true);setMessage("");
    const response=await supabase.rpc("rallora_reinstate_team",{p_withdrawal_id:withdrawal.id,p_notify:notify});
    setMessage(response.error?response.error.message:"Team reinstated.");
    if(!response.error)await load();
    setBusy(false);
  }

  async function saveMovement(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields=new FormData(event.currentTarget);
    const places=(key:string)=>fields.get(key)===""?null:Number(fields.get(key));
    setBusy(true);setMessage("");
    const response=await supabase.rpc("rallora_set_division_round_movement",{
      p_division_id:divisionId,p_promotion_places:places("promotion"),p_relegation_places:places("relegation"),
    });
    setMessage(response.error?response.error.message:"Movement settings saved for this division and round.");
    if(!response.error)await load();
    setBusy(false);
  }

  function resetPreview() {
    setPreview(null);setMessage("");setReason("");setTiming("now");
  }

  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.nav}><BackLink href={`/clubs/${slug}/admin`}>Back to club admin</BackLink></header>
    <section className={styles.hero}><h1>Withdraw Team &amp; Manage Byes</h1>
      <p>Review fixtures, record withdrawals and adjust movement for a division in this round.</p></section>
    {loadError&&<p role="alert">{loadError}</p>}
    {!data&&!loadError&&<p role="status">Loading competitions…</p>}
    {data&&<div className={editorStyles.form}>
      <label>Competition round<select value={seasonId} disabled={busy} onChange={e=>{setSeasonId(e.target.value);setDivisionId("");setTeamId("");resetPreview();}}>
        <option value="">Choose a competition round</option>
        {data.seasons.map(item=><option value={item.id} key={item.id}>{item.name} · {item.status}</option>)}
      </select></label>
      <label>Division<select disabled={!season||busy} value={divisionId} onChange={e=>{setDivisionId(e.target.value);setTeamId("");resetPreview();}}>
        <option value="">Choose a division</option>
        {data.divisions.filter(item=>item.season_id===seasonId).map(item=><option value={item.id} key={item.id}>{item.name}</option>)}
      </select></label>
      <label>Team<select disabled={!divisionId||busy} value={teamId} onChange={e=>{setTeamId(e.target.value);resetPreview();}}>
        <option value="">Choose a team</option>
        {data.teams.filter(item=>item.division_id===divisionId).map(item=><option value={item.id} key={item.id}>{teamLabel(item)}</option>)}
      </select></label>
      <label><input type="checkbox" checked={notify} onChange={e=>setNotify(e.target.checked)} disabled={busy}/> Notify affected players in Rallora</label>
    </div>}
    {teamId&&canChange&&(!withdrawal?<form className={editorStyles.form} onSubmit={withdraw}>
      <label>Withdraw<select value={timing} disabled={busy} onChange={e=>setTiming(e.target.value)}>
        <option value="now">Immediately</option>{rolling&&<option value="next_round">From the next round</option>}
      </select></label>
      <button type="button" disabled={busy} onClick={()=>void reviewFixtures()}>Review affected fixtures</button>
      {preview&&<>
        <div className={editorStyles.wide}>
          {timing==="next_round"?<p>Current fixtures and results stay in place. This pairing will be omitted when the next round is prepared.</p>:<>
            <p>Completed results stay on the table. Review any outstanding submissions or disputes before confirming.</p>
            {preview.fixtures.length>0?<ul>{preview.fixtures.map(fixture=><li key={fixture.fixture_id}>
              <strong>{fixture.opponent}</strong> · {fixture.play_by} · {fixture.decision==="bye"?"BYE – No match required":fixture.decision==="preserve"?"Keep completed result":"Resolve result before withdrawal"}
              {fixture.booking_starts_at&&<p>Court booking recorded for {dateTime(fixture.booking_starts_at)}. Check the booking with the club. Any friendly is outside the league.</p>}
            </li>)}</ul>:<p>This team has no fixtures in this round.</p>}
          </>}
        </div>
        <label className={editorStyles.wide}>Reason<textarea value={reason} required maxLength={1000} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
        <button type="submit" disabled={busy||!reason.trim()||timing==="now"&&preview.fixtures.some(item=>item.decision==="review")}>Confirm team withdrawal</button>
      </>}
    </form>:<section className={editorStyles.form}><p>This team has {withdrawal.timing==="now"?"withdrawn":"a withdrawal scheduled for the next round"}.</p>
      <button type="button" disabled={busy} onClick={()=>void reinstate()}>Reinstate team</button></section>)}
    {divisionId&&rolling&&canChange&&<form key={`${divisionId}:${override?.promotion_places}:${override?.relegation_places}`} className={editorStyles.form} onSubmit={saveMovement}>
      <h2 className={editorStyles.wide}>Promotion and relegation</h2>
      <p className={editorStyles.wide}>Leave a field blank to use the competition setting. These values apply when the next round is prepared.</p>
      <label>Promotion places<input type="number" min="0" step="1" placeholder={String(season?.promotion_places)} name="promotion" defaultValue={override?.promotion_places??""} disabled={busy}/></label>
      <label>Relegation places<input type="number" min="0" step="1" placeholder={String(season?.relegation_places)} name="relegation" defaultValue={override?.relegation_places??""} disabled={busy}/></label>
      <button type="submit" disabled={busy}>Save movement settings</button>
    </form>}
    {message&&<p className={styles.message} role="status">{message}</p>}
    {data&&season&&<section>
      <h2>Audit history</h2>
      {data.withdrawals.filter(item=>item.season_id===seasonId).map(item=><p key={item.id}>
        <strong>{data.teams.find(team=>team.id===item.team_id)?teamLabel(data.teams.find(team=>team.id===item.team_id)!):"Team"}</strong>
        {" · "}{item.timing==="now"?"Withdrawn":"Withdrawal scheduled"} {dateTime(item.created_at)} · {item.fixture_ids.length} affected fixtures. {item.reason}
        {item.reinstated_at&&` Reinstated ${dateTime(item.reinstated_at)}.`}
      </p>)}
      {data.movementHistory.filter(item=>item.division_id===divisionId).map(item=><p key={item.id}>
        {dateTime(item.changed_at)} · Promotion {item.previous_settings?.[0]??"default"} → {item.new_settings[0]??"default"} · Relegation {item.previous_settings?.[1]??"default"} → {item.new_settings[1]??"default"}
      </p>)}
    </section>}
  </div></main>;
}
