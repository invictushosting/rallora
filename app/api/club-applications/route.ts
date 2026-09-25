import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PLANS=new Set(["starter","league","pro"]);

function reply(payload:Record<string,unknown>,status=200){
  return NextResponse.json(payload,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}

export async function POST(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!service)return reply({error:"Club applications are temporarily unavailable."},503);

  const body=await request.json().catch(()=>null) as null|{
    email?:unknown;password?:unknown;manager_name?:unknown;mobile?:unknown;
    club_name?:unknown;slug?:unknown;plan?:unknown;
  };

  const email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";
  const password=typeof body?.password==="string"?body.password:"";
  const managerName=typeof body?.manager_name==="string"?body.manager_name.trim():"";
  const mobile=typeof body?.mobile==="string"?body.mobile.trim():"";
  const clubName=typeof body?.club_name==="string"?body.club_name.trim():"";
  const slug=typeof body?.slug==="string"?body.slug.trim().toLowerCase():"";
  const plan=typeof body?.plan==="string"?body.plan:"";

  if(!/^\S+@\S+\.\S+$/.test(email)||password.length<8||password.length>200||
     managerName.length<2||managerName.length>120||mobile.length<7||mobile.length>40||
     clubName.length<2||clubName.length>120||!SLUG.test(slug)||!PLANS.has(plan)){
    return reply({error:"Check your details and try again."},400);
  }

  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});

  const [{data:slugClub},{data:slugApplication}]=await Promise.all([
    admin.from("clubs").select("id").eq("slug",slug).maybeSingle(),
    admin.from("rallora_club_applications").select("id").eq("requested_slug",slug).in("status",["pending","activated"]).maybeSingle(),
  ]);
  if(slugClub||slugApplication)return reply({error:"That club web address is already in use. Choose another."},409);

  const {data:created,error:createError}=await admin.auth.admin.createUser({
    email,password,email_confirm:true,
    user_metadata:{name:managerName,phone:mobile,source:"club_application"},
  });
  if(createError||!created.user){
    return reply({error:createError?.message?.toLowerCase().includes("already")?
      "An account already exists for this email. Choose Sign in instead.":
      "We could not create your account. Check your details and try again."},400);
  }

  const {error:applicationError}=await admin.from("rallora_club_applications").insert({
    applicant_user_id:created.user.id,
    applicant_name:managerName,
    club_name:clubName,
    requested_slug:slug,
    contact_email:email,
    contact_phone:mobile,
    plan_code:plan,
    status:"pending",
  });

  if(applicationError){
    await admin.auth.admin.deleteUser(created.user.id).catch(()=>undefined);
    return reply({error:"We could not submit your club application. Please try again."},503);
  }

  return reply({ok:true},201);
}
