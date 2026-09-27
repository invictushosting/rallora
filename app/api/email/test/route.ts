import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { sendRalloraEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!anon) return NextResponse.json({error:"Email test is not configured."},{status:503});
  const jar=await cookies();
  const db=createServerClient(url,anon,{cookies:{getAll(){return jar.getAll()},setAll(next){for(const cookie of next){try{jar.set(cookie.name,cookie.value,cookie.options)}catch{}}}}});
  const {data:{user}}=await db.auth.getUser();
  if(!user) return NextResponse.json({error:"Sign in first."},{status:401});
  const body=await request.json().catch(()=>null) as {clubId?:string;to?:string}|null;
  if(!body?.clubId||!body.to) return NextResponse.json({error:"Club and recipient are required."},{status:400});
  const [{data:club,error:clubError},{data:member},{data:platform}]=await Promise.all([
    db.from("clubs").select("id,name,email_sender_name,contact_email").eq("id",body.clubId).single(),
    db.from("rallora_club_memberships").select("role,status").eq("club_id",body.clubId).eq("user_id",user.id).eq("status","active").maybeSingle(),
    db.from("rallora_platform_admins").select("user_id").eq("user_id",user.id).maybeSingle()
  ]);
  if(clubError||!club) return NextResponse.json({error:"Club not found."},{status:404});
  if(!platform&&!["owner","admin","organiser"].includes(member?.role??"")) return NextResponse.json({error:"Not authorised."},{status:403});
  const sender=club.email_sender_name||club.name;
  await sendRalloraEmail({
    to:body.to, clubName:sender, replyTo:club.contact_email||"support@rallora.app",
    subject:`Your ${club.name} email setup is ready`,
    text:`This is a live Rallora email test for ${club.name}. Future league emails can use this club identity while being securely delivered by Rallora.`,
    html:`<div style="background:#E8F2F9;padding:32px 16px;font-family:Inter,Lato,Arial,sans-serif;color:#061A39"><div style="max-width:560px;margin:auto;background:#FFFFFF;border-radius:18px;padding:32px"><h1 style="font-size:25px;margin:0 0 8px;color:#061A39">Email setup complete.</h1><p style="line-height:1.6;color:#52677c">This is a live email test for <strong>${club.name}</strong>.</p><p style="line-height:1.6;color:#52677c">Future league updates can appear from <strong>${sender}</strong>, securely delivered through Rallora.</p><div style="margin-top:28px;padding-top:20px;border-top:1px solid #E8F2F9;text-align:center"><a href="https://rallora.app" style="display:inline-block;text-decoration:none"><img src="https://rallora.app/brand/rallora-horizontal-light.svg" width="160" alt="Rallora" style="display:block;width:160px;max-width:100%;height:auto;margin:0 auto;border:0" /></a><div style="margin-top:10px;font-size:12px;color:#8191a2">Powered by Rallora · Club league management</div></div></div></div>`
  });
  return NextResponse.json({ok:true});
}
