import {supportResponse as reply,supportSession,UUID} from '@/lib/support-server';
export async function GET(request:Request){
 const {db,user}=await supportSession(true);
 if(!user)return reply({error:'Platform admin access required.'},403);
 const params=new URL(request.url).searchParams,q=(params.get('q')||'').trim();
 if(q.length<3||q.length>254)return reply({error:'Enter at least three characters.'},400);
 const {data,error}=await db.rpc('rallora_support_player_lookup',{p_query:q,p_exact:params.get('exact')==='true'});
 if(error)return reply({error:'Player lookup is unavailable. Check the support migration.'},503);
 return reply({players:data??[]});
}

export async function POST(request:Request){
 const {db,user}=await supportSession(true);
 if(!user)return reply({error:'Platform admin access required.'},403);
 const input=await request.json().catch(()=>null);
 if(typeof input?.userId!=='string'||typeof input?.seasonId!=='string'||!UUID.test(input.userId)||!UUID.test(input.seasonId)){
  return reply({error:'Choose a valid player and competition.'},400);
 }
 const {data,error}=await db.rpc('rallora_admin_reconcile_player_account',{p_user_id:input.userId,p_season_id:input.seasonId});
 if(error)return reply({error:'Team access could not be checked. Please try again.'},503);
 return reply({linked:data??0});
}
