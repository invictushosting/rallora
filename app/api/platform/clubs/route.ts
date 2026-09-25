import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function reply(payload:Record<string,unknown>,status=200){
  return NextResponse.json(payload,{status,headers:{"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"}});
}

export async function POST(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!anon)return reply({error:"Manual club creation is not configured on this deployment."},503);

  const jar=await cookies();
  const db=createServerClient(url,anon,{cookies:{
    getAll(){return jar.getAll()},
    setAll(next){for(const cookie of next){try{jar.set(cookie.name,cookie.value,cookie.options)}catch{}}}
  }});

  const {data:{session},error:sessionError}=await db.auth.getSession();
  if(sessionError||!session?.access_token)return reply({error:"Sign in as a Rallora Platform Admin first."},401);

  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=="object")return reply({error:"Invalid request."},400);

  const response=await fetch(`${url}/functions/v1/platform-create-club`,{
    method:"POST",
    headers:{
      Authorization:`Bearer ${session.access_token}`,
      apikey:anon,
      "Content-Type":"application/json",
    },
    body:JSON.stringify(body),
    cache:"no-store",
  });

  const payload=await response.json().catch(()=>({error:"Could not create the club."})) as Record<string,unknown>;
  return reply(payload,response.status);
}
