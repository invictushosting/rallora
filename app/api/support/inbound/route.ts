import {createClient} from '@supabase/supabase-js';
import {supportResponse as reply} from '@/lib/support-server';
import {verifySupportWebhook,supportReplyToken,supportSender,supportEmailText} from '@/lib/support-inbound';
export async function POST(request:Request){
 const secret=process.env.RESEND_WEBHOOK_SECRET,domain=process.env.SUPPORT_REPLY_DOMAIN,key=process.env.RESEND_API_KEY,url=process.env.NEXT_PUBLIC_SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret||!domain||!key||!url||!service)return reply({error:'Inbound support is not configured.'},503);
 if(Number(request.headers.get('content-length')||0)>256000)return reply({error:'Payload too large.'},413);
 const raw=await request.text();if(raw.length>256000)return reply({error:'Payload too large.'},413);
 if(!verifySupportWebhook(raw,request.headers,secret))return reply({error:'Invalid webhook signature.'},401);
 let event;try{event=JSON.parse(raw);}catch{return reply({error:'Invalid event.'},400);}
 if(event.type!=='email.received')return reply({ok:true});
 const token=supportReplyToken(event.data?.to,domain),emailId=event.data?.email_id;
 if(!token)return reply({ok:true,ignored:true});
 if(typeof emailId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(emailId))return reply({error:'Invalid email identifier.'},400);
 try{
  const response=await fetch(`https://api.resend.com/emails/receiving/${emailId}`,{headers:{Authorization:`Bearer ${key}`},cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)return reply({error:'Receiving API unavailable. Retry this event.'},503);
  const email=await response.json(),sender=supportSender(email.from);
  // Use the verified receiving API, not the webhook's sender/body fields.
  if(!sender||supportReplyToken(email.to,domain)!==token)return reply({ok:true,ignored:true});
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc('rallora_support_receive_reply',{p_token:token,p_provider_id:emailId,p_sender:sender,p_body:supportEmailText(email)});
  if(error)return reply({error:'Could not save the reply. Retry this event.'},503);
  return reply({ok:true,result:data});
 }catch{return reply({error:'Could not process email. Retry this event.'},503);}
}
