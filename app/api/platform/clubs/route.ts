import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PLANS=new Set(["starter","league","pro"]);

function reply(payload:Record<string,unknown>,status=200){
  return NextResponse.json(payload,{status,headers:{"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"}});
}

export async function POST(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!service)return reply({error:"Manual owner creation is not configured on this deployment."},503);

  const jar=await cookies();
  const db=createServerClient(url,anon,{cookies:{
    getAll(){return jar.getAll()},
    setAll(next){for(const cookie of next){try{jar.set(cookie.name,cookie.value,cookie.options)}catch{}}}
  }});
  const {data:{user}}=await db.auth.getUser();
  if(!user)return reply({error:"Sign in as a Rallora Platform Admin first."},401);
  const {data:platformAdmin,error:adminError}=await db.from("rallora_platform_admins").select("user_id").eq("user_id",user.id).maybeSingle();
  if(adminError)return reply({error:"Could not verify Platform Admin access."},503);
  if(!platformAdmin)return reply({error:"Platform Admin access is required."},403);

  const body=await request.json().catch(()=>null) as null|Record<string,unknown>;
  const text=(key:string,max=200)=>typeof body?.[key]==="string"?String(body[key]).trim().slice(0,max):"";
  const name=text("name",120),slug=text("slug",120).toLowerCase(),ownerEmail=text("ownerEmail",320).toLowerCase();
  const ownerPassword=typeof body?.ownerPassword==="string"?String(body.ownerPassword):"";
  const contactName=text("contactName",120),contactPhone=text("contactPhone",40),address1=text("address1",200);
  const town=text("town",120),postcode=text("postcode",30),country=text("country",120)||"United Kingdom",plan=text("plan",20);

  if(name.length<2||!SLUG.test(slug)||!/^\S+@\S+\.\S+$/.test(ownerEmail)||!PLANS.has(plan)||
    contactName.length<2||contactPhone.length<7||address1.length<3||town.length<2||postcode.length<2){
    return reply({error:"Check the club and owner details, then try again."},400);
  }

  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  let createdUserId:string|null=null;

  const existing=await admin.auth.admin.listUsers({page:1,perPage:1000});
  if(existing.error)return reply({error:"Could not check the owner account."},503);
  let owner=existing.data.users.find(item=>item.email?.toLowerCase()===ownerEmail)??null;

  if(!owner){
    if(ownerPassword.length<8)return reply({error:"Enter a temporary password of at least 8 characters for this new owner."},400);
    const created=await admin.auth.admin.createUser({
      email:ownerEmail,password:ownerPassword,email_confirm:true,
      user_metadata:{name:contactName,phone:contactPhone,source:"platform_manual_club"},
    });
    if(created.error||!created.data.user)return reply({error:created.error?.message||"Could not create the owner account."},400);
    owner=created.data.user;createdUserId=owner.id;
  }

  const createdClub=await db.rpc("rallora_platform_create_club_with_details",{
    p_name:name,p_slug:slug,p_owner_email:ownerEmail,p_plan_code:plan,p_contact_name:contactName,
    p_contact_phone:contactPhone,p_address_line_1:address1,p_town:town,p_postcode:postcode,p_country:country,
  });

  if(createdClub.error){
    if(createdUserId)await admin.auth.admin.deleteUser(createdUserId).catch(()=>undefined);
    return reply({error:createdClub.error.message},400);
  }

  return reply({ok:true,ownerCreated:Boolean(createdUserId),clubId:createdClub.data});
}
