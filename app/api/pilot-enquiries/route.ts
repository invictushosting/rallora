import {sendRalloraEmail,isEmailAddress} from "@/lib/email";
import {renderRalloraEmail} from "@/lib/email-templates";
import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;
    const clubName=String(body.clubName||"").trim(),name=String(body.name||"").trim(),email=String(body.email||"").trim().toLowerCase(),location=String(body.location||"").trim();
    if(clubName.length<2||name.length<2||!isEmailAddress(email)||location.length<2)return NextResponse.json({error:"Please complete the required fields."},{status:400});
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if(!url||!key)return NextResponse.json({error:"Enquiries are temporarily unavailable."},{status:503});
    // Public enquiry inserts are deliberately limited by RLS to new rows only. No service-role credential is required here.
    const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {error}=await supabase.from("rallora_pilot_enquiries").insert({club_name:clubName,contact_name:name,contact_email:email,contact_phone:body.phone?String(body.phone).trim():null,club_location:location,court_count:body.courts?Number(body.courts):null,enquiry_type:body.interest==="information"?"information":"pilot",message:body.message?String(body.message).trim().slice(0,1500):null});
    if(error)throw error;
    const deliveries: Promise<{id:string}>[]=[];
    {
      const safe=(value:unknown)=>String(value??"").replace(/[<>&"']/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[char]||char));
      const from=process.env.RALLORA_EMAIL_FROM||"Rallora <support@rallora.app>";
      deliveries.push(sendRalloraEmail({from,to:["hello@rallora.app"],replyTo:email,subject:`New Rallora ${body.interest==="information"?"information request":"pilot club enquiry"} — ${clubName}`,html:renderRalloraEmail({preview:`New enquiry from ${clubName}`,eyebrow:"PLATFORM ENQUIRY",title:"A new club has been in touch.",contentHtml:`<h2>New Rallora enquiry</h2><p><strong>Club:</strong> ${safe(clubName)}</p><p><strong>Contact:</strong> ${safe(name)}</p><p><strong>Email:</strong> ${safe(email)}</p><p><strong>Phone:</strong> ${safe(body.phone||"Not supplied")}</p><p><strong>Location:</strong> ${safe(location)}</p><p><strong>Courts:</strong> ${safe(body.courts||"Not supplied")}</p><p><strong>Interest:</strong> ${body.interest==="information"?"Further information":"Pilot club"}</p><p><strong>Message:</strong><br>${safe(body.message||"No message supplied")}</p>`})}));
      deliveries.push(sendRalloraEmail({from,to:[email],replyTo:"hello@rallora.app",subject:"We’ve received your Rallora enquiry",html:renderRalloraEmail({
        preview:`Thanks for getting in touch about ${clubName}.`,eyebrow:"ENQUIRY RECEIVED",title:"Your club.\nLet’s talk padel.",
        contentHtml:`<p>Hi ${safe(name)},</p><p>Thanks for getting in touch about bringing <strong>${safe(clubName)}</strong> to Rallora.</p><p>We’ve received your details and our team will review them shortly.</p><h2 style="font-size:18px;color:#061a39">What happens next?</h2><p>We’ll review your club and requirements, then contact you directly about the Rallora pilot programme.</p><p>Less admin. More padel.</p>`,
        helpText:"A question about your enquiry? Reply to this email to reach the Rallora team.",
      }),text:`Hi ${name},\n\nThanks for getting in touch about bringing ${clubName} to Rallora.\n\nWe’ve received your details and our team will review them shortly. We’ll contact you directly about the Rallora pilot programme.\n\nLess admin. More padel.\nThe Rallora team`}));
    }
    const outcomes=await Promise.allSettled(deliveries);
    outcomes.forEach((outcome,index)=>{if(outcome.status==="rejected")console.error("pilot_email_failed",index===0?"staff":"acknowledgement",outcome.reason instanceof Error?outcome.reason.message:"Unknown delivery error")});
    // The enquiry is already saved: email failure must not invite duplicate submissions.
    return NextResponse.json({ok:true,emailAccepted:outcomes.every(outcome=>outcome.status==="fulfilled")});
  }catch(error){console.error("pilot enquiry",error);return NextResponse.json({error:"We couldn't send your enquiry. Please try again."},{status:500});}
}
