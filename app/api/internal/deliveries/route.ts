import {createClient} from '@supabase/supabase-js';
import {NextRequest,NextResponse} from 'next/server';
import {sendRalloraEmail,escapeEmailHtml} from '@/lib/email';
import {renderClubEmail} from '@/lib/email-templates';
import {communicationActionUrl,type DeliveryMessage} from '@/lib/communication';
export const maxDuration=300;
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function POST(request:NextRequest) {
 const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
 if(!token||!/^[a-f0-9]{64}$/.test(token)) return NextResponse.json({error:'Not authorised'},{status:401,headers});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key||!process.env.RESEND_API_KEY) return NextResponse.json({error:'Delivery service is not configured'},{status:503,headers});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const claimed=await db.rpc('rallora_claim_deliveries',{p_token:token});
 if(claimed.error) return NextResponse.json({error:'Not authorised or delivery queue unavailable'},{status:403,headers});
 const jobs=claimed.data as DeliveryMessage[];
 if(!Array.isArray(jobs)) return NextResponse.json({error:'Delivery queue unavailable'},{status:503,headers});
 let accepted=0,failed=0;
 for(const job of jobs) {
  let providerId:string|null=null,failure:string|null=null;
  try {
   const action=communicationActionUrl(job.actionUrl);
   const reply=await sendRalloraEmail({to:job.to,subject:job.title,clubName:job.brand.sender,replyTo:job.brand.replyTo,
    idempotencyKey:`rallora-delivery-${job.id}`,text:`${job.title}\n\n${job.body}\n\nOpen your club: ${action}`,
    html:renderClubEmail(job.brand,{preview:job.body,eyebrow:'YOUR LEAGUE UPDATE',title:job.title,contentHtml:`<p>${escapeEmailHtml(job.body)}</p>`,action:{label:'Open your club',url:action}})});
   providerId=reply.id;accepted++;
  } catch {failure='Email provider could not accept this message. An automatic retry is scheduled.';failed++;}
  const finished=await db.rpc('rallora_finish_delivery',{p_token:token,p_id:job.id,p_provider_id:providerId,p_error:failure});
  if(finished.error) return NextResponse.json({error:'Delivery acknowledgement failed; the queue will recover automatically'},{status:503,headers});
 }
 return NextResponse.json({accepted,failed},{headers});
}
