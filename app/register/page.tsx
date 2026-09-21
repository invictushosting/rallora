"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

type Club={id:string;name:string;slug:string;short_name:string|null};
export default function ChooseClubRegistration(){
 const supabase=useMemo(()=>createClient(),[]); const [clubs,setClubs]=useState<Club[]>([]);const [error,setError]=useState("");
 useEffect(()=>{void supabase.from("clubs").select("id,name,slug,short_name").eq("is_active",true).order("name").then(({data,error})=>{if(error)setError(error.message);else setClubs((data??[]) as Club[]);});},[supabase]);
 return <main style={{maxWidth:760,margin:"50px auto",padding:24}}><Link href="/">← Rallora</Link><h1>Join a club league</h1><p>Choose your club, then select the team you want to join. A club organiser reviews every request.</p>{error&&<p role="alert">{error}</p>}<section style={{display:"grid",gap:12}}>{clubs.map(club=><Link key={club.id} href={"/clubs/"+club.slug+"/register"} style={{border:"1px solid #dbe4ee",borderRadius:12,padding:20,textDecoration:"none",color:"#061a39"}}><strong>{club.name}</strong><span style={{display:"block",marginTop:5}}>Register to join →</span></Link>)}{!error&&!clubs.length&&<p>No clubs are accepting registrations yet.</p>}</section></main>;
}
