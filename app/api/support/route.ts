import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendRalloraEmail } from "@/lib/email";

export async function POST(request:Request){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!anon)return NextResponse.json({error:"Support is unavailable."},{status:503});
  const jar=await cookies();
  const db=createServerClient(url,anon,{cookies:{getAll(){return jar.getAll()},setAll(next){for(const cookie of next){try{jar.set(cookie.name,cookie.value,cookie.options)}catch{}}}}});
  const {data:{user}}=await db.auth.getUser();
  if(!user?.email)return NextResponse.json({error:"Sign in first."},{status:401});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const category=String(body?.category||"general_help"),subject=String(body?.subject||"").trim(),message=String(body?.message||"").trim();
  if(subject.length<3||message.length<5)return NextResponse.json({error:"Please add a subject and details."},{status:400});
  const allowed=["bug","general_help","registration","billing","feature_request","other"];
  if(!allowed.includes(category))return NextResponse.json({error:"Invalid support category."},{status:400});
  const {error}=await db.from("rallora_support_requests").insert({club_id:body?.clubId||null,user_id:user.id,requester_name:body?.name?String(body.name).trim():null,requester_email:user.email,category,subject,message,priority:category==="bug"?"high":"normal"});
  if(error)return NextResponse.json({error:error.message},{status:500});
  await sendRalloraEmail({to:"hello@rallora.app",subject:`New Rallora support request — ${subject}`,replyTo:user.email,text:`Category: ${category}\nFrom: ${user.email}\n\n${message}`,html:`<div style="font-family:Arial,sans-serif"><h2>New Rallora support request</h2><p><strong>Category:</strong> ${category.replaceAll("_"," ")}</p><p><strong>From:</strong> ${user.email}</p><p><strong>Subject:</strong> ${subject}</p><p>${message.replaceAll("<","&lt;").replaceAll(">","&gt;")}</p></div>`}).catch(()=>null);
  return NextResponse.json({ok:true});
}