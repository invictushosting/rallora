import { createCipheriv, randomBytes } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const CLUB_ROLES = ["owner","admin","organiser"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TOKEN_URL = "https://thirdparty.playtomic.io/api/v1/oauth/token";

function reply(payload:Record<string,unknown>,status=200){
  return NextResponse.json(payload,{status,headers:{
    "Cache-Control":"private, no-store, max-age=0",
    "X-Content-Type-Options":"nosniff",
  }});
}

function encryptionKey(){
  const encoded=process.env.RALLORA_INTEGRATION_ENCRYPTION_KEY;
  if(!encoded)return null;
  const key=Buffer.from(encoded,"base64");
  return key.length===32?key:null;
}

function encrypt(secret:string,key:Buffer){
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",key,iv);
  const ciphertext=Buffer.concat([cipher.update(secret,"utf8"),cipher.final()]);
  return {
    ciphertext:ciphertext.toString("base64"),
    iv:iv.toString("base64"),
    authTag:cipher.getAuthTag().toString("base64"),
  };
}

async function context(slug:string){
  if(!SLUG.test(slug))return {status:400 as const};
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return {status:503 as const};
  const jar=await cookies();
  const db=createServerClient(url,key,{cookies:{
    getAll(){return jar.getAll()},
    setAll(next){for(const cookie of next){try{jar.set(cookie.name,cookie.value,cookie.options)}catch{}}}
  }});
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user)return {status:401 as const};
  const {data:club,error:clubError}=await db.from("clubs").select("id,slug").eq("slug",slug).eq("is_active",true).maybeSingle();
  if(clubError)return {status:503 as const};
  if(!club)return {status:404 as const};
  const [membership,operator]=await Promise.all([
    db.from("rallora_club_memberships").select("role,status").eq("club_id",club.id).eq("user_id",user.id).eq("status","active").maybeSingle(),
    db.from("rallora_platform_admins").select("user_id").eq("user_id",user.id).maybeSingle(),
  ]);
  if(membership.error||operator.error)return {status:503 as const};
  const allowed=operator.data?.user_id===user.id||
    (membership.data?.status==="active"&&CLUB_ROLES.includes(membership.data.role));
  if(!allowed)return {status:403 as const};
  return {status:200 as const,db,club,user};
}

export async function GET(request:NextRequest){
  const slug=request.nextUrl.searchParams.get("club")||"";
  const ctx=await context(slug);
  if(ctx.status!==200)return reply({error:"Integration access unavailable."},ctx.status);
  const {data,error}=await ctx.db.from("rallora_club_integrations")
    .select("provider,status,client_id,last_verified_at,last_sync_at,last_error,updated_at")
    .eq("club_id",ctx.club.id).eq("provider","playtomic").maybeSingle();
  if(error)return reply({error:"Could not load integration status."},503);
  return reply({integration:data??null});
}

export async function POST(request:NextRequest){
  const input=await request.json().catch(()=>null) as null|{club?:unknown;client_id?:unknown;client_secret?:unknown};
  const slug=typeof input?.club==="string"?input.club:"";
  const clientId=typeof input?.client_id==="string"?input.client_id.trim():"";
  const secret=typeof input?.client_secret==="string"?input.client_secret.trim():"";
  if(!clientId||clientId.length>300||!secret||secret.length>1000){
    return reply({error:"Enter a valid Playtomic Client ID and Client Secret."},400);
  }
  const key=encryptionKey();
  if(!key)return reply({error:"Secure integration storage is not configured yet."},503);
  const ctx=await context(slug);
  if(ctx.status!==200)return reply({error:"Integration access unavailable."},ctx.status);

  let tokenOk=false;
  try{
    const tokenResponse=await fetch(TOKEN_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({client_id:clientId,secret}),
      cache:"no-store",
      signal:AbortSignal.timeout(10000),
    });
    if(tokenResponse.ok){
      const body=await tokenResponse.json().catch(()=>null) as null|{access_token?:unknown};
      tokenOk=typeof body?.access_token==="string"&&body.access_token.length>0;
    }
  }catch{
    return reply({error:"Playtomic could not be reached. Try again shortly."},502);
  }
  if(!tokenOk)return reply({error:"Playtomic rejected these credentials. Check the Client ID and Client Secret."},400);

  const encrypted=encrypt(secret,key);
  const saved=await ctx.db.rpc("rallora_save_playtomic_integration",{
    p_club_id:ctx.club.id,p_client_id:clientId,p_ciphertext:encrypted.ciphertext,
    p_iv:encrypted.iv,p_auth_tag:encrypted.authTag,
  });
  if(saved.error)return reply({error:"Could not save the verified Playtomic connection."},503);
  const state=await ctx.db.rpc("rallora_set_playtomic_integration_state",{
    p_club_id:ctx.club.id,p_status:"connected",p_error:null,p_verified:true,
  });
  if(state.error)return reply({error:"Connection verified but status could not be updated."},503);
  return reply({connected:true});
}

export async function DELETE(request:NextRequest){
  const input=await request.json().catch(()=>null) as null|{club?:unknown};
  const slug=typeof input?.club==="string"?input.club:"";
  const ctx=await context(slug);
  if(ctx.status!==200)return reply({error:"Integration access unavailable."},ctx.status);
  const result=await ctx.db.rpc("rallora_disconnect_playtomic_integration",{p_club_id:ctx.club.id});
  if(result.error)return reply({error:"Could not disconnect Playtomic."},503);
  return reply({disconnected:true});
}
