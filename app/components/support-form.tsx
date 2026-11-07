"use client";
import {useEffect,useState} from 'react';
import {sendSupportRequest} from '@/lib/support-request';

type Options={email:string;name:string;clubs:{id:string;name:string}[];seasons:{id:string;club_id:string;name:string}[];memberships:{club_id:string;season_id:string}[]};
export default function SupportForm({clubId}:{clubId?:string}){
 const [category,setCategory]=useState('general_help'),[subject,setSubject]=useState(''),[message,setMessage]=useState(''),[name,setName]=useState(''),[club,setClub]=useState(clubId||''),[season,setSeason]=useState(''),[screenshot,setScreenshot]=useState<File|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[options,setOptions]=useState<Options|null>(null);
 useEffect(()=>{let active=true;fetch('/api/support').then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error);if(active){setOptions(data);setName(current=>current||data.name);const memberships=data.memberships as Options['memberships'];const unique=[...new Set(memberships.map(m=>m.club_id))];if(!clubId&&unique.length===1)setClub(unique[0]);const matching=memberships.filter(m=>!clubId||m.club_id===clubId);if(matching.length===1)setSeason(matching[0].season_id);}}).catch(e=>{if(active)setNotice(e.message||'Could not load your details.');});return()=>{active=false;};},[clubId]);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;if(screenshot&&screenshot.size>3*1024*1024){setNotice('Screenshot must be under 3 MB.');return;}
  const form=e.currentTarget;setBusy(true);setNotice('');
  try{const result=await sendSupportRequest({clubId:club||undefined,seasonId:season||undefined,name,category,subject,message,page:window.location.pathname},screenshot);setNotice(result.message);if(result.ok){setSubject('');setMessage('');setScreenshot(null);const upload=form.elements.namedItem('screenshot') as HTMLInputElement|null;if(upload)upload.value='';}}finally{setBusy(false);}
 }
 const field={padding:12,border:'1px solid #cbd9e7',borderRadius:10,font:'inherit',width:'100%'};
 const label={display:'grid',gap:6,fontWeight:700} as const;
 return <section style={{marginTop:28,padding:20,border:'1px solid #dce7f1',borderRadius:16,background:'#fff'}}>
  <small style={{fontWeight:900,letterSpacing:'1px',color:'#3975bd'}}>RALLORA SUPPORT</small><h2 style={{margin:'7px 0'}}>Help & support</h2><p>Tell us what happened. Your account and page details are attached automatically.</p>
  <form onSubmit={submit} style={{display:'grid',gap:12}}>
   <label style={label}>Your name<input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} style={field}/></label>
   {options&&<p>We’ll reply to <strong>{options.email}</strong>.</p>}
   <label style={label}>Club<select value={club} onChange={e=>{setClub(e.target.value);setSeason('');}} style={field}><option value="">Not sure / general Rallora question</option>{options?.clubs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   {club&&<label style={label}>League<select value={season} onChange={e=>setSeason(e.target.value)} style={field}><option value="">Not sure / not league-specific</option>{options?.seasons.filter(s=>s.club_id===club).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
   <label style={label}>What do you need help with?<select value={category} onChange={e=>setCategory(e.target.value)} style={field}><option value="general_help">General help</option><option value="login">Login / account access</option><option value="registration">Registration issue</option><option value="match_chat">Match Chat</option><option value="results">Fixtures / results</option><option value="bug">Report a bug</option><option value="billing">Billing</option><option value="feature_request">Feature request</option><option value="other">Other</option></select></label>
   <label style={label}>Subject<input required minLength={3} maxLength={200} value={subject} onChange={e=>setSubject(e.target.value)} style={field}/></label>
   <label style={label}>Details<textarea required minLength={5} maxLength={10000} rows={5} value={message} onChange={e=>setMessage(e.target.value)} style={field}/></label>
   <label style={label}>Screenshot (optional)<input name="screenshot" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setScreenshot(e.target.files?.[0]||null)} style={field}/><small>PNG, JPEG or WebP, up to 3 MB. Avoid including passwords or other private details.</small></label>
   <button disabled={busy} style={{minHeight:46,border:0,borderRadius:10,background:'#061A39',color:'#fff',fontWeight:850,cursor:'pointer'}}>{busy?'Sending…':'Send to Rallora support'}</button>
  </form>{notice&&<p role="status" style={{fontWeight:700}}>{notice}</p>}
 </section>;
}
