import {supportSession,supportResponse as reply} from '@/lib/support-server';
export async function GET(request:Request){
 const {db,user}=await supportSession(true);if(!user)return reply({error:'Platform admin access required.'},403);
 const q=(new URL(request.url).searchParams.get('q')||'').trim();
 if(q.length<3||q.length>254)return reply({ticketIds:[]});
 const pattern=`%${q.replace(/[\\%_]/g,'\\$&')}%`;
 const results=await Promise.all([
  db.from('rallora_support_activities').select('ticket_id').ilike('detail',pattern).limit(100),
  db.from('rallora_support_activities').select('ticket_id').ilike('actor_label',pattern).limit(100),
  db.from('rallora_support_messages').select('ticket_id').ilike('body',pattern).limit(100),
  db.from('rallora_support_messages').select('ticket_id').ilike('actor_label',pattern).limit(100)
 ]);
 if(results.some(r=>r.error))return reply({error:'Activity search is unavailable. Ticket details are still searchable.'},503);
 return reply({ticketIds:[...new Set(results.flatMap(r=>(r.data??[]).map(row=>row.ticket_id)))],limited:results.some(r=>r.data?.length===100)});
}
