"use client";
import {useState} from "react";

export default function SupportForm({clubId}:{clubId?:string}){
 const [category,setCategory]=useState("general_help"),[subject,setSubject]=useState(""),[message,setMessage]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setNotice("");const response=await fetch("/api/support",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clubId,category,subject,message})});const body=await response.json().catch(()=>({})) as {error?:string};if(response.ok){setSubject("");setMessage("");setNotice("Support request sent. Rallora has received it.");}else setNotice(body.error||"Could not send your request.");setBusy(false)}
 return <section style={{marginTop:28,padding:20,border:"1px solid #dce7f1",borderRadius:16,background:"#fff"}}>
  <small style={{fontWeight:900,letterSpacing:"1px",color:"#3975bd"}}>RALLORA SUPPORT</small><h2 style={{margin:"7px 0"}}>Help & support</h2><p style={{color:"#65758b"}}>Need help or spotted a problem? Send it directly to the Rallora support team.</p>
  <form onSubmit={submit} style={{display:"grid",gap:12}}>
   <label style={{display:"grid",gap:6,fontWeight:700}}>What do you need help with?<select value={category} onChange={e=>setCategory(e.target.value)} style={{padding:12,border:"1px solid #cbd9e7",borderRadius:10}}><option value="general_help">General help</option><option value="bug">Report a bug</option><option value="registration">Registration issue</option><option value="billing">Billing</option><option value="feature_request">Feature request</option><option value="other">Other</option></select></label>
   <label style={{display:"grid",gap:6,fontWeight:700}}>Subject<input required minLength={3} value={subject} onChange={e=>setSubject(e.target.value)} style={{padding:12,border:"1px solid #cbd9e7",borderRadius:10}}/></label>
   <label style={{display:"grid",gap:6,fontWeight:700}}>Details<textarea required minLength={5} rows={5} value={message} onChange={e=>setMessage(e.target.value)} style={{padding:12,border:"1px solid #cbd9e7",borderRadius:10,font:"inherit"}}/></label>
   <button disabled={busy} style={{minHeight:46,border:0,borderRadius:10,background:"#061A39",color:"#fff",fontWeight:850,cursor:"pointer"}}>{busy?"Sending…":"Send to Rallora support"}</button>
  </form>{notice&&<p role="status" style={{fontWeight:700}}>{notice}</p>}
 </section>
}