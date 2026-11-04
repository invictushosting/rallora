import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export function supportResponse(payload: unknown, status = 200) {
 return NextResponse.json(payload, {status, headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
export async function supportSession(adminOnly = false) {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key) throw new Error('Support is not configured.');
 const jar=await cookies();
 const db=createServerClient(url,key,{cookies:{getAll:()=>jar.getAll(),setAll(next){for(const c of next){try{jar.set(c.name,c.value,c.options)}catch{}}}}});
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user?.email) return {db,user:null};
 if(adminOnly){
  const {data,error}=await db.from('rallora_platform_admins').select('user_id').eq('user_id',user.id).maybeSingle();
  if(error||!data) return {db,user:null};
 }
 return {db,user};
}
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
