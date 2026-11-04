"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {playerAccessChecks,type SupportPlayer} from '@/lib/support-workspace';
import styles from './support-workspace.module.css';

type Message={id:string;actor_label:string;direction:string;body:string;recipient:string;delivery_status:string;created_at:string};
type Activity={id:string;actor_label:string;detail:string;created_at:string};
type Workspace={players:SupportPlayer[];messages:Message[];activities:Activity[];diagnostics:Record<string,string|null>;screenshotUrl:string|null;threadingEnabled:boolean;emailEnabled:boolean};
function date(value:string|null){return value?new Date(value).toLocaleString('en-GB'):'Never';}
function PlayerCard({player,onResend,disabled}:{player:SupportPlayer;onResend?:(inviteId:string)=>void;disabled?:boolean}){
 return <article className={styles.player}>
  <h4>{player.name||player.email}</h4><p>{player.email}</p>{player.playtomicEmail&&<p>Playtomic email: {player.playtomicEmail}</p>}
  <ul className={styles.checks}>{playerAccessChecks(player).map(check=><li key={check}>{check}</li>)}</ul>
  <p className={styles.muted}>Last sign-in: {date(player.lastSignIn)}</p>
  {player.teams.map(team=><div className={styles.team} key={team.id}><strong>{team.players}</strong><p>{team.club} · {team.season} · {team.division}{!team.active?' · Inactive team':''}</p><p>{team.fixtures} fixtures · {team.openFixtures} open and available</p><div className={styles.actions}><a href={`/clubs/${team.slug}/admin/registrations`}>Open registrations</a><a href={`/clubs/${team.slug}/admin`}>Club admin</a><a href={`/clubs/${team.slug}/captain?team=${team.id}`}>View as captain</a><a href={`/clubs/${team.slug}?season=${team.seasonId}&view=fixtures`}>View fixtures</a></div></div>)}
  {player.registrations.map((r,i)=><p key={i}>Registration: <strong>{r.status}</strong> · {r.captain} / {r.partner} · {r.season}</p>)}
  {player.invites.map(invite=><div key={invite.id} className={styles.invite}><span>Invitation: <strong>{invite.status}</strong> · {invite.season}</span>{invite.status==='pending'&&<div className={styles.actions}><a href={`/clubs/${invite.slug}/join-team?invite=${invite.id}`}>Open claim link</a><button type="button" onClick={()=>void navigator.clipboard.writeText(`${window.location.origin}/clubs/${invite.slug}/join-team?invite=${invite.id}`).catch(()=>window.prompt('Copy invitation link',`${window.location.origin}/clubs/${invite.slug}/join-team?invite=${invite.id}`))}>Copy claim link</button>{onResend&&player.teams.some(t=>t.active&&t.id===invite.teamId)&&<button type="button" disabled={disabled} onClick={()=>onResend(invite.id)}>Resend invitation</button>}</div>}</div>)}
 </article>;
}
export function SupportPlayerSearch(){
 const [query,setQuery]=useState(''),[players,setPlayers]=useState<SupportPlayer[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const requestVersion=useRef(0);
 async function search(e:React.FormEvent){e.preventDefault();const version=++requestVersion.current;setBusy(true);setNotice('');setPlayers([]);try{const r=await fetch(`/api/platform/support/players?q=${encodeURIComponent(query)}`,{cache:'no-store'});const data=await r.json();if(version!==requestVersion.current)return;if(!r.ok)throw Error(data.error);setPlayers(data.players);if(!data.players.length)setNotice('No matching account or invitation found.');}catch(e){if(version===requestVersion.current)setNotice(e instanceof Error?e.message:'Player lookup failed.');}finally{if(version===requestVersion.current)setBusy(false);}}
 return <section className={styles.workspace} aria-label="Admin player search"><h3>Find a player</h3><p>Search Rallora email, Playtomic email or player name. Up to 20 matches.</p><form onSubmit={search} className={styles.search}><label>Player name or email<input required minLength={3} maxLength={254} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players…"/></label><button disabled={busy}>{busy?'Searching…':'Search players'}</button></form>{notice&&<p role="status">{notice}</p>}{players.map(player=><PlayerCard key={player.email} player={player}/>)}</section>;
}
export default function SupportWorkspace({ticketId,recipient,onChanged}:{ticketId:string;recipient:string;onChanged:()=>void}){
 const [data,setData]=useState<Workspace|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const attempt=useRef<{id:string;body:string;action:string;inviteId?:string}|null>(null);
 const load=useCallback(async(signal?:AbortSignal)=>{const r=await fetch(`/api/platform/support/${ticketId}`,{cache:'no-store',signal});const result=await r.json();if(!r.ok)throw Error(result.error);setData(result);setError('');},[ticketId]);
 useEffect(()=>{const controller=new AbortController();load(controller.signal).catch(e=>{if(!controller.signal.aborted)setError(e.message||'Could not load support context.');});return()=>controller.abort();},[load,refresh]);
 async function send(action:string,inviteId?:string,retry?:Message){
  if(busy)return;setBusy(true);setNotice('');
  const content=retry?.body??(action==='reply'?body.trim():'');
  if(retry)attempt.current={id:retry.id,body:content,action};
  if(!attempt.current||attempt.current.body!==content||attempt.current.action!==action||attempt.current.inviteId!==inviteId)attempt.current={id:crypto.randomUUID(),body:content,action,inviteId};
  try{const r=await fetch(`/api/platform/support/${ticketId}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,body:content,inviteId,messageId:attempt.current.id})});const result=await r.json();if(!r.ok)throw Error(result.error);setNotice(result.message);if(action==='reply')setBody('');attempt.current=null;onChanged();setRefresh(v=>v+1);}catch(e){setNotice(e instanceof Error?e.message:'Sending could not be confirmed. Retry this same message.');setRefresh(v=>v+1);}finally{setBusy(false);}
 }
 return <section className={styles.workspace} aria-label="Ticket investigation and replies">
  <div className={styles.heading}><h3>Player & access checks</h3><button type="button" onClick={()=>setRefresh(v=>v+1)} disabled={busy}>Refresh checks & history</button></div>
  {error?<p role="alert">{error}</p>:!data?<p role="status">Loading player context…</p>:<>
   {!data.players.length&&<p>No account or invitation matched this ticket email. Use Find a player above to investigate another address.</p>}
   {data.players.map(player=><PlayerCard key={player.email} player={player} disabled={busy||!data.emailEnabled} onResend={id=>void send('resend_invite',id)}/>)}
   <details><summary>Page & device details</summary>{Object.keys(data.diagnostics||{}).length?<dl>{Object.entries(data.diagnostics).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value||'Not captured'}</dd></div>)}</dl>:<p>Not captured for this older ticket.</p>}{data.screenshotUrl&&<a href={data.screenshotUrl} target="_blank" rel="noreferrer">Open private screenshot</a>}</details>
   <h3>Conversation & activity</h3><ol className={styles.timeline}>{[
    ...data.activities.map(a=>({id:a.id,time:a.created_at,actor:a.actor_label,label:'Admin activity',body:a.detail,message:undefined})),
    ...data.messages.map(m=>({id:m.id,time:m.created_at,actor:m.actor_label,label:`${m.direction==='inbound'?'Player reply':m.direction==='invitation'?'Invitation resend':'Support reply'} · ${m.delivery_status==='accepted'?'Accepted for sending':m.delivery_status==='failed'?'Send unconfirmed — retry safely':m.delivery_status==='pending'?'Awaiting send confirmation':m.delivery_status}`,body:m.body,message:m}))
   ].sort((a,b)=>a.time.localeCompare(b.time)).map(item=><li key={item.id}><strong>{item.label}</strong><small>{item.actor} · {date(item.time)}</small><p>{item.body}</p>{item.message&&item.message.direction==="outbound"&&["pending","failed"].includes(item.message.delivery_status)&&<button type="button" disabled={busy} onClick={()=>void send("reply",undefined,item.message)}>Retry this saved reply</button>}</li>)}</ol>{!data.activities.length&&!data.messages.length&&<p>No recorded activity yet. Earlier actions were not tracked.</p>}
   <form onSubmit={e=>{e.preventDefault();void send('reply');}} className={styles.composer}><h3>Reply to player</h3><p>From support@rallora.app to <strong>{recipient}</strong></p><label>Your reply<textarea required minLength={5} maxLength={10000} rows={5} value={body} onChange={e=>setBody(e.target.value)} placeholder="Explain the next step clearly…" disabled={busy}/></label>{!data.threadingEnabled&&<p className={styles.muted}>Email replies currently return to the support mailbox. Automatic replies into this ticket need the inbound email connection configured.</p>}{!data.emailEnabled&&<p role="alert">Email sending is not configured on this deployment.</p>}<button disabled={busy||!data.emailEnabled||body.trim().length<5}>{busy?'Sending…':'Send reply & wait for player'}</button></form>
  </>}{notice&&<p role="status">{notice}</p>}
 </section>;
}
