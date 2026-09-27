import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;
    const clubName=String(body.clubName||"").trim(),name=String(body.name||"").trim(),email=String(body.email||"").trim().toLowerCase(),location=String(body.location||"").trim();
    if(clubName.length<2||name.length<2||!email.includes("@")||location.length<2)return NextResponse.json({error:"Please complete the required fields."},{status:400});
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if(!url||!key)return NextResponse.json({error:"Enquiries are temporarily unavailable."},{status:503});
    // Public enquiry inserts are deliberately limited by RLS to new rows only. No service-role credential is required here.
    const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {error}=await supabase.from("rallora_pilot_enquiries").insert({club_name:clubName,contact_name:name,contact_email:email,contact_phone:body.phone?String(body.phone).trim():null,club_location:location,court_count:body.courts?Number(body.courts):null,enquiry_type:body.interest==="information"?"information":"pilot",message:body.message?String(body.message).trim().slice(0,1500):null});
    if(error)throw error;
    const resendKey=process.env.RESEND_API_KEY;
    if(resendKey){
      const safe=(value:unknown)=>String(value??"").replace(/[<>&"']/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[char]||char));
      await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":`Bearer ${resendKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.RALLORA_EMAIL_FROM||"Rallora <support@rallora.app>",to:["hello@rallora.app"],reply_to:email,subject:`New Rallora ${body.interest==="information"?"information request":"pilot club enquiry"} — ${clubName}`,html:`<h2>New Rallora enquiry</h2><p><strong>Club:</strong> ${safe(clubName)}</p><p><strong>Contact:</strong> ${safe(name)}</p><p><strong>Email:</strong> ${safe(email)}</p><p><strong>Phone:</strong> ${safe(body.phone||"Not supplied")}</p><p><strong>Location:</strong> ${safe(location)}</p><p><strong>Courts:</strong> ${safe(body.courts||"Not supplied")}</p><p><strong>Interest:</strong> ${body.interest==="information"?"Further information":"Pilot club"}</p><p><strong>Message:</strong><br>${safe(body.message||"No message supplied")}</p>`})});
    }
    return NextResponse.json({ok:true});
  }catch(error){console.error("pilot enquiry",error);return NextResponse.json({error:"We couldn't send your enquiry. Please try again."},{status:500});}
}
