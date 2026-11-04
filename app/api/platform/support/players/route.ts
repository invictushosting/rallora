import {supportResponse as reply,supportSession} from '@/lib/support-server';
export async function GET(request:Request){
 const {db,user}=await supportSession(true);
 if(!user)return reply({error:'Platform admin access required.'},403);
 const params=new URL(request.url).searchParams,q=(params.get('q')||'').trim();
 if(q.length<3||q.length>254)return reply({error:'Enter at least three characters.'},400);
 const {data,error}=await db.rpc('rallora_support_player_lookup',{p_query:q,p_exact:params.get('exact')==='true'});
 if(error)return reply({error:'Player lookup is unavailable. Check the support migration.'},503);
 return reply({players:data??[]});
}
