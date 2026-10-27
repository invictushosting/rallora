"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase";

type RequestRow={id:string;user_id:string|null;request_type:string;details:string;status:string;internal_notes:string|null;created_at:string;updated_at:string;closed_at:string|null};
const statuses=["received","identity_check","in_review","completed","declined"] as const;
const isClosed=(status:string)=>status==="completed"||status==="declined";
const reviewTarget=(createdAt:string)=>new Date(new Date(createdAt).getTime()+21*86400000);
const needsPriority=(row:RequestRow)=>!isClosed(row.status)&&reviewTarget(row.created_at).getTime()<=Date.now();
export default function PlatformPrivacyRequests(){
 const db=useMemo(()=>createClient(),[]);
 const [rows,setRows]=useState<RequestRow[]>([]);
 const [state,setState]=useState<"loading"|"ready"|"forbidden"|"error">("loading");
 const [error,setError]=useState(""),[saving,setSaving]=useState("");
 const [edits,setEdits]=useState<Record<string,{status:string;notes:string}>>({});
 const [filter,setFilter]=useState<"open"|"all"|"closed">("open");
 const reload=useCallback(async()=>{
   const {data:{user},error:authError}=await db.auth.getUser();
   if(authError||!user){setState("forbidden");return;}
   const {data:admin,error:adminError}=await db.from("rallora_platform_admins").select("user_id").eq("user_id",user.id).maybeSingle();
   if(adminError||!admin){setState("forbidden");return;}
   const {data,error:fetchError}=await db.rpc("rallora_admin_list_privacy_requests");
   if(fetchError){setState("error");setError("Unable to load privacy requests.");return;}
   const next=(data??[]) as RequestRow[];
   setRows(next);
   setEdits(Object.fromEntries(next.map(x=>[x.id,{status:x.status,notes:x.internal_notes??""}])));
   setState("ready");
 },[db]);
 useEffect(()=>{void reload();},[reload]);
 const openRows=rows.filter(row=>!isClosed(row.status));
 const priorityCount=openRows.filter(needsPriority).length;
 const visibleRows=rows.filter(row=>filter==="all"||(filter==="closed"?isClosed(row.status):!isClosed(row.status)));
 async function update(row:RequestRow){
   const edit=edits[row.id];
   if(!edit||!statuses.some(s=>s===edit.status))return;
   if((edit.status==="completed"||edit.status==="declined")&&!window.confirm("Confirm that all required verification and handling steps have been completed? This records a status decision; it does not export or erase data."))return;
   setSaving(row.id);setError("");
   const {error:saveError}=await db.rpc("rallora_admin_update_privacy_request",{p_request_id:row.id,p_status:edit.status,p_notes:edit.notes});
   setSaving("");
   if(saveError){setError("Could not save this request. Please review permissions and status.");return;}
   await reload();
 }
 return <main style={{maxWidth:1050,margin:"0 auto",padding:"40px 24px",lineHeight:1.6}}>
 <Link href="/platform">← Platform</Link><h1>Privacy request review</h1>
 <p>Restricted to Rallora platform administrators. Review identity, controller responsibilities, statutory deadlines and relevant legal exceptions before changing status. Completing a request here <strong>does not</strong> automatically export or delete information.</p>
 {state==="loading"?<p>Loading…</p>:state==="forbidden"?<p>Sign in as an authorised platform administrator to continue.</p>:state==="error"?<p role="alert">{error}</p>:<>
 <p><strong>{openRows.length} open requests</strong> · {priorityCount} past the internal review target · {rows.length} retrieved (up to 200).</p>
 <p><strong>21-day internal review target:</strong> This is a reminder to act early, not a statutory deadline. Check the normal one-calendar-month UK GDPR response period, identity verification, extensions and controller responsibilities separately. This page does not send email alerts or monitor itself.</p>
 {priorityCount>0&&<p role="status" style={{color:"#9a3412",fontWeight:700}}>{priorityCount} unresolved request(s) need urgent review by the assigned privacy lead.</p>}
 <label>Show requests <select value={filter} onChange={e=>setFilter(e.target.value as "open"|"all"|"closed")}><option value="open">Open</option><option value="all">All retrieved</option><option value="closed">Closed</option></select></label>
 <p>Oldest unresolved requests are shown first. A designated staff member must still monitor the queue and any requests beyond the 200-row limit.</p>
 {error&&<p role="alert">{error}</p>}
 {visibleRows.map(row=><section key={row.id} style={{border:"1px solid #cbd5e1",borderRadius:12,padding:20,marginBottom:16}}>
   <h2 style={{fontSize:18}}>{row.request_type.replaceAll("_"," ")} · {row.status.replaceAll("_"," ")}</h2>
   <p>Received {new Date(row.created_at).toLocaleString("en-GB")} · Request {row.id}</p>
   {!isClosed(row.status)&&<p style={{fontWeight:600,color:needsPriority(row)?"#9a3412":"inherit"}}>Internal review target: {reviewTarget(row.created_at).toLocaleDateString("en-GB")}{needsPriority(row)?" · Needs urgent review":""}</p>}
   <p>Account identifier: <code>{row.user_id??"Account removed"}</code></p>
   <p style={{whiteSpace:"pre-wrap"}}>{row.details||"No additional details supplied."}</p>
   <label style={{display:"block"}}>Review status
     <select value={edits[row.id]?.status??row.status} onChange={e=>setEdits(old=>({...old,[row.id]:{...old[row.id],status:e.target.value}}))} disabled={row.status==="completed"||row.status==="declined"}>
       {statuses.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}
     </select>
   </label>
   <label style={{display:"block",marginTop:10}}>Internal handling notes — restricted to platform administrators
     <textarea rows={3} maxLength={4000} style={{display:"block",width:"100%"}} value={edits[row.id]?.notes??""} onChange={e=>setEdits(old=>({...old,[row.id]:{...old[row.id],notes:e.target.value}}))}/>
   </label>
   <button type="button" disabled={saving===row.id||row.status==="completed"||row.status==="declined"} onClick={()=>void update(row)} style={{padding:10,marginTop:10}}>{saving===row.id?"Saving…":"Save review"}</button>
 </section>)}
 {!rows.length&&<p>No privacy requests recorded.</p>}
 </>}
 </main>;
}
