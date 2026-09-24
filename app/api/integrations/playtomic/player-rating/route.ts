import { createDecipheriv } from "node:crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const TOKEN_URL="https://thirdparty.playtomic.io/api/v1/oauth/token";
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function reply(payload:Record<string,unknown>,status=200){
  return NextResponse.json(payload,{status,headers:{"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"}});
}
function key(){
  const encoded=process.env.RALLORA_INTEGRATION_ENCRYPTION_KEY;
  if(!encoded)return null;
  const value=Buffer.from(encoded,"base64");
  return value.length===32?value:null;
}
function decrypt(ciphertext:string,iv:string,authTag:string,encryptionKey:Buffer){
  const decipher=createDecipheriv("aes-256-gcm",encryptionKey,Buffer.from(iv,"base64"));
  decipher.setAuthTag(Buffer.from(authTag,"base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext,"base64")),decipher.final()]).toString("utf8");
}

export async function GET(request:NextRequest){
  const slug=request.nextUrl.searchParams.get("club")||"";
  if(!SLUG.test(slug))return reply({error:"Invalid club."},400);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encryptionKey=key();
  if(!url||!anon||!service||!encryptionKey)return reply({available:false,reason:"not_configured"},200);

  const jar=await cookies();
  const db=createServerClient(url,anon,{cookies:{getAll(){return jar.getAll()},setAll(next){for(const cookie of next){try{jar.set(cookie.name,cookie.value,cookie.options)}catch{}}}}});
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user?.email)return reply({error:"Sign in to sync your Playtomic rating."},401);

  const {data:club,error:clubError}=await db.from("clubs").select("id").eq("slug",slug).eq("is_active",true).maybeSingle();
  if(clubError)return reply({error:"Could not load club."},503);
  if(!club)return reply({error:"Club not found."},404);

  const admin=createAdminClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:integration,error:integrationError}=await admin.from("rallora_club_integrations")
    .select("id,client_id,external_venue_id,status").eq("club_id",club.id).eq("provider","playtomic").maybeSingle();
  if(integrationError)return reply({error:"Could not load Playtomic connection."},503);
  if(!integration||integration.status!=="connected"||!integration.client_id||!integration.external_venue_id){
    return reply({available:false,reason:"club_not_connected"},200);
  }
  const {data:secret,error:secretError}=await admin.from("rallora_integration_secrets")
    .select("ciphertext,iv,auth_tag").eq("integration_id",integration.id).maybeSingle();
  if(secretError||!secret)return reply({error:"Playtomic credentials are unavailable."},503);

  let clientSecret="";
  try{clientSecret=decrypt(secret.ciphertext,secret.iv,secret.auth_tag,encryptionKey)}
  catch{return reply({error:"Stored Playtomic credentials could not be decrypted."},503)}

  try{
    const tokenResponse=await fetch(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({client_id:integration.client_id,secret:clientSecret}),cache:"no-store",signal:AbortSignal.timeout(10000)});
    if(!tokenResponse.ok)return reply({error:"Playtomic connection needs to be re-verified."},502);
    const tokenBody=await tokenResponse.json().catch(()=>null) as null|{token?:unknown;access_token?:unknown};
    const token=typeof tokenBody?.token==="string"?tokenBody.token:typeof tokenBody?.access_token==="string"?tokenBody.access_token:"";
    if(!token)return reply({error:"Playtomic did not return an access token."},502);

    const wanted=user.email.trim().toLowerCase();
    let cursor="";
    let found:null|{player_id:string;name?:string;email?:string;sports?:Array<{sport_id?:string;level_value?:number|null}>}=null;
    for(let page=0;page<20&&!found;page++){
      const params=new URLSearchParams({limit:"100",include:"SPORTS"});
      if(cursor)params.set("cursor_id",cursor);
      const playersResponse=await fetch(`https://thirdparty.playtomic.io/api/v1/venues/${encodeURIComponent(integration.external_venue_id)}/players?${params}`,
        {headers:{Accept:"application/json",Authorization:`Bearer ${token}`},cache:"no-store",signal:AbortSignal.timeout(12000)});
      if(!playersResponse.ok)return reply({error:"Playtomic player data could not be read."},502);
      const body=await playersResponse.json().catch(()=>null) as null|{data?:Array<{player_id:string;name?:string;email?:string;sports?:Array<{sport_id?:string;level_value?:number|null}>}>;has_more?:boolean;next_cursor_id?:string};
      found=(body?.data??[]).find(player=>player.email?.trim().toLowerCase()===wanted)??null;
      if(found||!body?.has_more||!body.next_cursor_id)break;
      cursor=body.next_cursor_id;
    }

    if(!found){
      await admin.from("rallora_club_integrations").update({last_sync_at:new Date().toISOString(),last_error:null}).eq("id",integration.id);
      return reply({available:true,matched:false},200);
    }
    const padel=found.sports?.find(sport=>sport.sport_id==="PADEL");
    const rating=typeof padel?.level_value==="number"?padel.level_value:null;
    const syncedAt=new Date().toISOString();
    const {error:linkError}=await admin.from("rallora_playtomic_player_links").upsert({
      club_id:club.id,user_id:user.id,playtomic_player_id:found.player_id,padel_rating:rating,
      playtomic_name:found.name??null,playtomic_email:found.email??user.email,synced_at:syncedAt,updated_at:syncedAt,
    },{onConflict:"club_id,user_id"});
    if(linkError)return reply({error:"Playtomic rating was found but could not be saved."},503);
    await admin.from("rallora_club_integrations").update({last_sync_at:syncedAt,last_error:null}).eq("id",integration.id);
    return reply({available:true,matched:true,rating,synced_at:syncedAt},200);
  }catch{
    return reply({error:"Playtomic could not be reached. Try again shortly."},502);
  }
}
