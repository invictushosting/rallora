import {supportResponse as reply,supportSession,UUID} from '@/lib/support-server';
import {sendRalloraEmail,escapeEmailHtml} from '@/lib/email';
import {renderRalloraEmail} from '@/lib/email-templates';

type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,context:Context){
 const {db,user}=await supportSession(true);if(!user)return reply({error:'Platform admin access required.'},403);
 const {id}=await context.params;if(!UUID.test(id))return reply({error:'Invalid ticket.'},400);
 const ticket=await db.from('rallora_support_requests').select('*').eq('id',id).maybeSingle();
 if(ticket.error)return reply({error:'Could not load ticket.'},503);
 if(!ticket.data)return reply({error:'Ticket not found.'},404);
 const [messages,activities,players]=await Promise.all([
  db.from('rallora_support_messages').select('*').eq('ticket_id',id).order('created_at'),
  db.from('rallora_support_activities').select('*').eq('ticket_id',id).order('created_at'),
  db.rpc('rallora_support_player_lookup',{p_query:ticket.data.requester_email,p_exact:true})
 ]);
 if(messages.error||activities.error||players.error)return reply({error:'Support workspace is unavailable. Check the support migration.'},503);
 let screenshotUrl:string|null=null;
 if(ticket.data.screenshot_path){const result=await db.storage.from('support-screenshots').createSignedUrl(ticket.data.screenshot_path,300);screenshotUrl=result.data?.signedUrl??null;}
 return reply({players:players.data??[],messages:messages.data,activities:activities.data,diagnostics:ticket.data.diagnostics,screenshotUrl,threadingEnabled:Boolean(process.env.SUPPORT_REPLY_DOMAIN&&process.env.RESEND_WEBHOOK_SECRET&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.RESEND_RECEIVING_API_KEY),emailEnabled:Boolean(process.env.RESEND_API_KEY)});
}
export async function POST(request:Request,context:Context){
 const {db,user}=await supportSession(true);if(!user)return reply({error:'Platform admin access required.'},403);
 const {id}=await context.params;if(!UUID.test(id))return reply({error:'Invalid ticket.'},400);
 const input=await request.json().catch(()=>null);
 if(!input||!UUID.test(String(input.messageId||'')))return reply({error:'Invalid message.'},400);
 const {data:ticket,error}=await db.from('rallora_support_requests').select('id,subject,requester_email,reply_token,updated_at').eq('id',id).maybeSingle();
 if(error)return reply({error:'Could not load ticket.'},503);if(!ticket)return reply({error:'Ticket not found.'},404);
 const action=input.action;
 if(!['reply','resend_invite'].includes(action))return reply({error:'Invalid action.'},400);
 if(!process.env.RESEND_API_KEY)return reply({error:'Email delivery is not configured.'},503);
 let invitationLink:string|undefined;let body=String(input.body||'').trim();const recipient=ticket.requester_email;
 if(action==='resend_invite'){
  if(!UUID.test(String(input.inviteId||'')))return reply({error:'Choose an invitation.'},400);
  const {data:invite,error:inviteError}=await db.from('rallora_team_member_invites').select('id,club_id,invited_email,status,team_id').eq('id',input.inviteId).maybeSingle();
  if(inviteError)return reply({error:'Could not load invitation.'},503);
  if(!invite||invite.status!=='pending'||invite.invited_email.toLowerCase()!==ticket.requester_email.toLowerCase())return reply({error:'No pending invitation matches this ticket email.'},409);
  const [club,team]=await Promise.all([db.from('clubs').select('slug').eq('id',invite.club_id).single(),db.from('teams').select('is_active').eq('id',invite.team_id).maybeSingle()]);
  if(club.error||!team.data?.is_active)return reply({error:'The invitation has no active team. Review it before resending.'},409);
  const link=`https://www.rallora.app/clubs/${encodeURIComponent(club.data.slug)}/join-team?invite=${invite.id}`;
  invitationLink=link;
  body=`Your team invitation is ready. Open the link below, sign in using ${recipient}, then press Claim team place. You do not need to register for the league again.\n\n${link}`;
 }
 if(body.length<5||body.length>10000)return reply({error:'Enter a reply between 5 and 10,000 characters.'},400);
 const messageId=String(input.messageId);
 const reserved=await db.from('rallora_support_messages').insert({id:messageId,ticket_id:id,actor_id:user.id,actor_label:user.email,direction:action==='reply'?'outbound':'invitation',body,recipient});
 if(reserved.error&&reserved.error.code!=='23505')return reply({error:'Could not save the message. Nothing was sent.'},503);
 const {data:saved,error:savedError}=await db.from('rallora_support_messages').select('*').eq('id',messageId).single();
 if(savedError||saved.ticket_id!==id||saved.actor_id!==user.id||saved.body!==body||saved.recipient!==recipient||saved.direction!==(action==='reply'?'outbound':'invitation'))return reply({error:'Message identifier is already in use. Refresh before sending.'},409);
 if(saved.delivery_status==='accepted')return reply({ok:true,message:'Already accepted for sending.'});
 // Resend retains idempotency keys for 24 hours; never retry an old uncertain send.
 if(Date.now()-Date.parse(saved.created_at)>23*3600000)return reply({error:'This send attempt is too old to retry safely. Check email delivery before starting a new message.'},409);
 try{
  const replyDomain=process.env.RESEND_WEBHOOK_SECRET&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.RESEND_RECEIVING_API_KEY?process.env.SUPPORT_REPLY_DOMAIN:undefined;
  const replyTo=replyDomain&&/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(replyDomain)?`support+${ticket.reply_token}@${replyDomain}`:'support@rallora.app';
  const result=await sendRalloraEmail({to:recipient,subject:`Re: ${ticket.subject} [Rallora ${id.slice(0,8)}]`,replyTo,idempotencyKey:`support-${messageId}`,
   text:body,html:renderRalloraEmail({preview:'A reply from Rallora support',eyebrow:'RALLORA SUPPORT',title:action==='reply'?'Your support update':'Claim your team place',action:invitationLink?{label:'Claim your team place',url:invitationLink}:undefined,contentHtml:`<p style="white-space:pre-wrap">${escapeEmailHtml(body)}</p>`})});
  const update=await db.from('rallora_support_messages').update({delivery_status:'accepted',provider_id:result.id}).eq('id',messageId);
  if(update.error)return reply({error:'Email was accepted, but its saved status could not be updated. Retry this same send to reconcile it.'},503);
  const status=await db.from('rallora_support_requests').update({status:'waiting',updated_at:new Date().toISOString()}).eq('id',id).eq('updated_at',ticket.updated_at).select('id');
  return reply({ok:true,message:status.error||!status.data?.length?'Email accepted. Update the ticket status manually.':'Email accepted for sending. Ticket is waiting for player.'});
 }catch{
  await db.from('rallora_support_messages').update({delivery_status:'failed'}).eq('id',messageId).neq('delivery_status','accepted');
  return reply({error:'Sending could not be confirmed. Retry the same message; the send identifier prevents duplicates.'},502);
 }
}
