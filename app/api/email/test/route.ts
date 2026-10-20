import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { sendRalloraEmail, escapeEmailHtml, isEmailAddress } from "@/lib/email";
import { renderClubEmail } from "@/lib/email-templates";

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
    db.from("clubs").select("id,name,slug,logo_url,primary_color,email_sender_name,contact_email").eq("id",body.clubId).single(),
    db.from("rallora_club_memberships").select("role,status").eq("club_id",body.clubId).eq("user_id",user.id).eq("status","active").maybeSingle(),
    db.from("rallora_platform_admins").select("user_id").eq("user_id",user.id).maybeSingle()
  ]);
  if(clubError||!club) return NextResponse.json({error:"Club not found."},{status:404});
  if(!platform&&!["owner","admin","organiser"].includes(member?.role??"")) return NextResponse.json({error:"Not authorised."},{status:403});
  if (!isEmailAddress(body.to)) return NextResponse.json({error:"Choose a valid recipient email address."},{status:400});
  const sender=club.email_sender_name||club.name;
  try {
  await sendRalloraEmail({
    to:body.to, clubName:sender, replyTo:club.contact_email||"support@rallora.app",
    subject:`Your ${club.name} email setup is ready`,
    text:`This is a live Rallora email test for ${club.name}. Future league emails can use this club identity while being securely delivered by Rallora.`,
    html:renderClubEmail({name:club.name,logoUrl:club.logo_url,primaryColour:club.primary_color},{
      preview:`Your ${club.name} email setup is ready.`,eyebrow:"CLUB EMAIL TEST",title:"Your club.\nReady to connect.",
      contentHtml:`<p>Hi there,</p><p>This is a live email test for <strong>${escapeEmailHtml(club.name)}</strong>.</p><p>Your club logo and colours lead the design, with Powered by Rallora branding below. League updates appear from <strong>${escapeEmailHtml(sender)}</strong>.</p>`,
      action:{label:"View club hub",url:`https://www.rallora.app/clubs/${encodeURIComponent(club.slug)}`},
      helpText:club.contact_email?"A question about your league? Reply to this email to contact your club.":"Need a hand? Reply to this email to contact Rallora support.",
    })
  });
  return NextResponse.json({ok:true});
  } catch (error) {
    console.error("club_email_test_failed", error instanceof Error ? error.message : "Unknown delivery error");
    return NextResponse.json({error:"The test email could not be sent. Please try again later."},{status:502});
  }
}
