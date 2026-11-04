import {supportSession,supportResponse as reply,UUID} from '@/lib/support-server';
import {sendRalloraEmail,escapeEmailHtml} from '@/lib/email';
import {renderRalloraEmail} from '@/lib/email-templates';

export async function GET(){
 const {db,user}=await supportSession();if(!user?.email)return reply({error:'Sign in first.'},401);
 const [clubs,seasons,profile,memberships,invites]=await Promise.all([
  db.from('clubs').select('id,name').eq('is_active',true).order('name').limit(500),
  db.from('seasons').select('id,club_id,name').in('status',['active','draft']).order('created_at',{ascending:false}).limit(500),
  db.from('rallora_player_profiles').select('display_name').eq('user_id',user.id).maybeSingle(),
  db.from('rallora_team_roster_memberships').select('club_id,season_id').eq('player_user_id',user.id),
  db.from('rallora_team_member_invites').select('club_id,season_id,invited_name').ilike('invited_email',user.email.replace(/[\\%_]/g,'\\$&')).eq('status','pending')
 ]);
 if(clubs.error||seasons.error||profile.error||memberships.error||invites.error)return reply({error:'Could not load support details. Refresh to try again.'},503);
 const contexts=[...(memberships.data??[]),...(invites.data??[])];
 const uniqueContexts=[...new Map(contexts.map(c=>[`${c.club_id}:${c.season_id}`,{club_id:c.club_id,season_id:c.season_id}])).values()];
 return reply({email:user.email,name:profile.data?.display_name||(invites.data?.length===1?invites.data[0].invited_name:null)||(typeof user.user_metadata?.full_name==='string'?user.user_metadata.full_name:''),clubs:clubs.data,seasons:seasons.data,memberships:uniqueContexts});
}
export async function POST(request:Request){
 const {db,user}=await supportSession();if(!user?.email)return reply({error:'Sign in first.'},401);
 if(Number(request.headers.get('content-length')||0)>4*1024*1024)return reply({error:'Screenshot must be under 3 MB.'},413);
 let body:Record<string,unknown>|null=null,screenshot:File|null=null;
 try{
  if(request.headers.get('content-type')?.startsWith('multipart/form-data')){
   const form=await request.formData();body=JSON.parse(String(form.get('request')||''));
   const file=form.get('screenshot');if(file instanceof File&&file.size)screenshot=file;
  }else body=await request.json();
 }catch{return reply({error:'Invalid support request.'},400);}
 const category=String(body?.category||'general_help'),subject=String(body?.subject||'').trim(),message=String(body?.message||'').trim(),name=String(body?.name||'').trim();
 if(name.length<2||name.length>120||subject.length<3||subject.length>200||message.length<5||message.length>10000)return reply({error:'Add your name, a subject (3–200 characters) and details (5–10,000 characters).'},400);
 if(!['bug','general_help','registration','billing','feature_request','other','login','match_chat','results'].includes(category))return reply({error:'Invalid support category.'},400);
 const clubId=body?.clubId||null,seasonId=body?.seasonId||null;
 if((clubId&&!UUID.test(String(clubId)))||(seasonId&&!UUID.test(String(seasonId))))return reply({error:'Choose a valid club and league.'},400);
 if(seasonId){const {data,error}=await db.from('seasons').select('club_id').eq('id',seasonId).maybeSingle();if(error||!data||data.club_id!==clubId)return reply({error:'Choose a league belonging to the selected club.'},400);}
 const recent=await db.from('rallora_support_requests').select('id').eq('user_id',user.id).gte('created_at',new Date(Date.now()-60000).toISOString()).limit(1);
 if(recent.error)return reply({error:'Support is temporarily unavailable.'},503);
 if(recent.data?.length)return reply({error:'A request was received in the last minute. Please wait before sending another.'},429);
 const id=crypto.randomUUID();let screenshotPath:string|null=null;
 if(screenshot){
  if(screenshot.size>3*1024*1024)return reply({error:'Screenshot must be under 3 MB.'},413);
  const bytes=new Uint8Array(await screenshot.arrayBuffer());
  const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  const type=png?'image/png':jpeg?'image/jpeg':webp?'image/webp':null;
  if(!type)return reply({error:'Attach a PNG, JPEG or WebP screenshot.'},400);
  screenshotPath=`${user.id}/${id}.${png?'png':jpeg?'jpg':'webp'}`;
  const upload=await db.storage.from('support-screenshots').upload(screenshotPath,bytes,{contentType:type});
  if(upload.error)return reply({error:'Screenshot could not be uploaded. Try again or remove it.'},503);
 }
 let page:string|null=null;
 try{const source=new URL(String(body?.page||''),'https://www.rallora.app');if(source.pathname.startsWith('/'))page=source.pathname.slice(0,500);}catch{}
 const {error}=await db.from('rallora_support_requests').insert({id,club_id:clubId,season_id:seasonId,user_id:user.id,requester_name:name,requester_email:user.email,category,subject,message,priority:category==='bug'?'high':'normal',screenshot_path:screenshotPath,diagnostics:{page,browser:request.headers.get('user-agent')?.slice(0,500),appVersion:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,12)||'local',capturedAt:new Date().toISOString()}});
 if(error){if(screenshotPath)await db.storage.from('support-screenshots').remove([screenshotPath]);return reply({error:'Could not save your request. Your message is still here; please try again.'},503);}
 await sendRalloraEmail({to:'hello@rallora.app',subject:`New Rallora support request — ${subject}`,replyTo:user.email,text:`Ticket: ${id}\nCategory: ${category}\nFrom: ${name} (${user.email})\n\n${message}`,html:renderRalloraEmail({preview:`New support request: ${subject}`,eyebrow:'PLATFORM SUPPORT',title:'A player needs a hand.',contentHtml:`<p><strong>From:</strong> ${escapeEmailHtml(name)} (${escapeEmailHtml(user.email)})</p><p><strong>Subject:</strong> ${escapeEmailHtml(subject)}</p><p style="white-space:pre-wrap">${escapeEmailHtml(message)}</p>`})}).catch(()=>console.error('support_notification_failed',id));
 return reply({ok:true,ticketId:id});
}
