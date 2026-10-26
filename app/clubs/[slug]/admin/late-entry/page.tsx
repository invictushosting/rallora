"use client";

import BackLink from "@/app/components/back-link";
import {useCallback,useEffect,useMemo,useState} from "react";
import {useParams} from "next/navigation";
import {createClient} from "@/lib/supabase";
import styles from "./late-entry.module.css";

type Season={id:string;name:string;status:string};
type Division={id:string;season_id:string;name:string};
type Team={id:string;division_id:string;name:string;player_one_name:string|null;player_two_name:string|null};
type Result={team_id:string;partner_invite_id:string;fixtures_need_review:boolean;season_status:string};

export default function LateEntryPage(){
  const {slug}=useParams<{slug:string}>();
  const supabase=useMemo(()=>createClient(),[]);
  const [seasons,setSeasons]=useState<Season[]>([]);
  const [divisions,setDivisions]=useState<Division[]>([]);
  const [teams,setTeams]=useState<Team[]>([]);
  const [seasonId,setSeasonId]=useState("");
  const [divisionId,setDivisionId]=useState("");
  const [mode,setMode]=useState<"existing"|"new">("existing");
  const [sourceTeamId,setSourceTeamId]=useState("");
  const [teamName,setTeamName]=useState("");
  const [captainName,setCaptainName]=useState("");
  const [captainEmail,setCaptainEmail]=useState("");
  const [partnerName,setPartnerName]=useState("");
  const [partnerEmail,setPartnerEmail]=useState("");
  const [reason,setReason]=useState("");
  const [status,setStatus]=useState("Loading…");
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<Result|null>(null);

  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setStatus("Please sign in to administer this club.");return;}
    const club=await supabase.from("clubs").select("id").eq("slug",slug).maybeSingle();
    if(club.error||!club.data){setStatus("Club not found.");return;}
    const [member,platform]=await Promise.all([
      supabase.from("rallora_club_memberships").select("role,status").eq("club_id",club.data.id).eq("user_id",user.id).maybeSingle(),
      supabase.from("rallora_platform_admins").select("user_id").eq("user_id",user.id).maybeSingle()
    ]);
    if(!platform.data&&(!member.data||member.data.status!=="active"||!["owner","admin","organiser"].includes(member.data.role))){
      setStatus("You do not have permission to add teams for this club.");return;
    }
    const seasonReply=await supabase.from("seasons").select("id,name,status").eq("club_id",club.data.id);
    if(seasonReply.error){setStatus(seasonReply.error.message);return;}
    const allSeasons=(seasonReply.data??[]) as Season[];
    const eligible=allSeasons.filter(s=>["draft","active"].includes(s.status));
    setSeasons(eligible);
    const ids=allSeasons.map(s=>s.id);
    if(!ids.length){setStatus("Create a league before adding a team.");return;}
    const divisionReply=await supabase.from("divisions").select("id,season_id,name").in("season_id",ids).order("sort_order");
    if(divisionReply.error){setStatus(divisionReply.error.message);return;}
    const ds=(divisionReply.data??[]) as Division[];
    setDivisions(ds);
    if(ds.length){
      const teamReply=await supabase.from("teams").select("id,division_id,name,player_one_name,player_two_name").in("division_id",ds.map(d=>d.id)).eq("is_active",true);
      if(teamReply.error){setStatus(teamReply.error.message);return;}
      setTeams((teamReply.data??[]) as Team[]);
    }
    setSeasonId(current=>current||eligible[0]?.id||"");
    setStatus(eligible.length?"":"No draft or active leagues available.");
  },[slug,supabase]);

  useEffect(()=>{void load();},[load]);
  const season=seasons.find(s=>s.id===seasonId);
  const eligibleDivisions=divisions.filter(d=>d.season_id===seasonId);
  const sourceTeams=teams.filter(t=>divisions.some(d=>d.id===t.division_id&&d.season_id!==seasonId));
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!seasonId||!divisionId||reason.trim().length<3)return;
    setBusy(true);setStatus("");setResult(null);
    const response=await supabase.rpc("rallora_admin_add_late_team",{
      p_season_id:seasonId,p_division_id:divisionId,p_mode:mode,p_reason:reason.trim(),
      p_source_team_id:mode==="existing"?sourceTeamId:null,
      p_team_name:mode==="new"?teamName.trim():null,
      p_captain_name:mode==="new"?captainName.trim():null,
      p_captain_email:mode==="new"?captainEmail.trim().toLowerCase():null,
      p_partner_name:mode==="new"?partnerName.trim():null,
      p_partner_email:mode==="new"?partnerEmail.trim().toLowerCase():null
    });
    setBusy(false);
    if(response.error){setStatus(response.error.message);return;}
    setResult(response.data as Result);
    setReason("");setSourceTeamId("");
    await load();
  }
  return <main className={styles.page}><div className={styles.shell}>
    <BackLink href={`/clubs/${slug}/admin/registrations`}>Back to registrations</BackLink>
    <header><span className={styles.eyebrow}>CLUB ADMIN · REGISTRATION OVERRIDE</span>
      <h1>Add a late team</h1><p>Add an existing club pairing from another league or register a new pairing after the deadline. Existing fixtures and results will not be changed.</p></header>
    {result?<section className={styles.success} role="status">
      <h2>Team registered successfully</h2>
      <p>The captain now has a roster place. Send the partner this claim link so they can join the team:</p>
      <a href={`/clubs/${slug}/join-team?invite=${result.partner_invite_id}`}>Open partner invitation</a>
      {result.fixtures_need_review?<p><strong>Fixture action required:</strong> This league already has fixtures. Review the division schedule and arrange the new pairing&apos;s matches manually. No published fixtures or results were deleted.</p>:<p>Generate the competition fixtures when all pairings have been assigned.</p>}
      <button type="button" onClick={()=>setResult(null)}>Add another team</button>
    </section>:null}
    {status?<p role="status" className={styles.notice}>{status}</p>:null}
    <form className={styles.form} onSubmit={submit}>
      <label>League<select required value={seasonId} onChange={e=>{setSeasonId(e.target.value);setDivisionId("");setSourceTeamId("");}}>
        <option value="">Choose league</option>{seasons.map(s=><option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
      </select></label>
      <label>Division<select required value={divisionId} onChange={e=>setDivisionId(e.target.value)}>
        <option value="">Choose division</option>{eligibleDivisions.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
      </select></label>
      <div className={styles.modeRow}><button type="button" aria-pressed={mode==="existing"} onClick={()=>setMode("existing")}>Existing team</button><button type="button" aria-pressed={mode==="new"} onClick={()=>setMode("new")}>Create new team</button></div>
      {mode==="existing"?<label>Existing pairing at this club<select required value={sourceTeamId} onChange={e=>setSourceTeamId(e.target.value)}>
        <option value="">Choose registered pairing</option>{sourceTeams.map(t=><option key={t.id} value={t.id}>{t.name} ({divisions.find(d=>d.id===t.division_id)?.name})</option>)}
      </select><small>This creates a new league entry and keeps the original competition history unchanged. The pairing needs an existing captain account and a partner email.</small></label>:
      <div className={styles.fields}>
        <label>Team name<input required minLength={2} maxLength={120} value={teamName} onChange={e=>setTeamName(e.target.value)}/></label>
        <label>Captain name<input required minLength={2} maxLength={120} value={captainName} onChange={e=>setCaptainName(e.target.value)}/></label>
        <label>Captain&apos;s Rallora account email<input required type="email" value={captainEmail} onChange={e=>setCaptainEmail(e.target.value)}/><small>The captain must already have a Rallora login.</small></label>
        <label>Partner name<input required minLength={2} maxLength={120} value={partnerName} onChange={e=>setPartnerName(e.target.value)}/></label>
        <label>Partner email<input required type="email" value={partnerEmail} onChange={e=>setPartnerEmail(e.target.value)}/></label>
      </div>}
      <label>Reason for deadline override<textarea required minLength={3} maxLength={500} rows={3} placeholder="e.g. Captain contacted us after registration closed" value={reason} onChange={e=>setReason(e.target.value)}/></label>
      <p className={styles.warning}><strong>{season?.status==="active"?"Active competition:":"Draft competition:"}</strong> Adding a team never regenerates fixtures automatically. Existing match results remain untouched. Admin changes are recorded in an audit log.</p>
      <button className={styles.submit} disabled={busy||!seasonId||!divisionId||reason.trim().length<3||(mode==="existing"?!sourceTeamId:!teamName.trim()||!captainName.trim()||!captainEmail.trim()||!partnerName.trim()||!partnerEmail.trim())}>{busy?"Registering…":"Confirm late registration"}</button>
    </form>
  </div></main>;
}
