"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase";

type RequestRow={id:string;request_type:string;status:string;created_at:string};
const options=[
 ["access","Access to my personal data"],
 ["rectification","Correct inaccurate data"],
 ["erasure","Request account/data deletion"],
 ["portability","Request portable data"],
 ["restriction","Restrict processing"],
 ["objection","Object to processing"],
 ["other","Another privacy request"]
] as const;

export default function PrivacyRequests(){
 const db=useMemo(()=>createClient(),[]);
 const [signedIn,setSignedIn]=useState<boolean|null>(null);
 const [kind,setKind]=useState<string>("access"),[details,setDetails]=useState("");
 const [items,setItems]=useState<RequestRow[]>([]),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
   let active=true;
   void (async()=>{
     const {data:{user}}=await db.auth.getUser();
     if(!active)return;
     setSignedIn(Boolean(user));
     if(!user)return;
     const {data,error:loadError}=await db.from("rallora_privacy_requests")
       .select("id,request_type,status,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20);
     if(!active)return;
     if(loadError)setError("Your request history is temporarily unavailable.");
     else setItems((data??[]) as RequestRow[]);
   })();
   return()=>{active=false};
 },[db]);
 async function submit(event:React.FormEvent<HTMLFormElement>){
   event.preventDefault();setError("");setNotice("");setBusy(true);
   try{
     if(!options.some(x=>x[0]===kind))throw new Error("Select a request type.");
     if(details.length>2000)throw new Error("Use at most 2000 characters.");
     const {data:{user},error:authError}=await db.auth.getUser();
     if(authError||!user)throw new Error("Sign in again before submitting.");
     const {data,error:saveError}=await db.from("rallora_privacy_requests")
       .insert({user_id:user.id,request_type:kind,details:details.trim()})
       .select("id,request_type,status,created_at").single();
     if(saveError||!data)throw new Error("We could not record your request. Please email support@rallora.app.");
     setItems(old=>[data as RequestRow,...old].slice(0,20));
     setDetails("");setNotice("Your privacy request has been recorded. It has not automatically changed or deleted your data.");
   }catch(caught){setError(caught instanceof Error?caught.message:"Could not submit request.");}
   finally{setBusy(false);}
 }
 return <main style={{maxWidth:740,margin:"0 auto",padding:"48px 24px",lineHeight:1.6}}>
   <Link href="/account">← Back to account</Link><h1>Privacy and your information</h1>
   <p>Ask to access, correct, export or delete personal information associated with Rallora. Read our <Link href="/privacy">privacy information</Link>.</p>
   <p>Requests are reviewed by a person. Account deletion is <strong>not automatic</strong>: we may need to verify identity, consult relevant clubs and retain records required by law.</p>
   {signedIn===false?<p>To use your account request history, <Link href="/login">sign in</Link>. You can also contact <a href="mailto:support@rallora.app">support@rallora.app</a> without a Rallora account.</p>:signedIn===null?<p>Checking your session…</p>:<>
   <form onSubmit={submit} style={{display:"grid",gap:12}}>
     <label>What would you like to request?
       <select value={kind} onChange={e=>setKind(e.target.value)} style={{display:"block",width:"100%",padding:10}}>
         {options.map(([value,label])=><option key={value} value={value}>{label}</option>)}
       </select>
     </label>
     <label>Additional information (optional)
       <textarea rows={4} maxLength={2000} value={details} onChange={e=>setDetails(e.target.value)}
         style={{display:"block",width:"100%",padding:10}} placeholder="Only include details needed to identify the information in question."/>
     </label>
     <button disabled={busy} style={{padding:12}}>{busy?"Submitting…":"Submit privacy request"}</button>
   </form>
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
   <h2>Your recent requests</h2>
   {items.length?<ul>{items.map(item=><li key={item.id}>{options.find(x=>x[0]===item.request_type)?.[1]??item.request_type} — {item.status.replaceAll("_"," ")} — {new Date(item.created_at).toLocaleDateString("en-GB")}</li>)}</ul>:<p>No requests recorded for this account.</p>}
   </>}
   <p>For urgent privacy concerns or if you cannot access your account, email <a href="mailto:support@rallora.app">support@rallora.app</a>. We may ask for enough information to verify the request.</p>
 </main>;
}
