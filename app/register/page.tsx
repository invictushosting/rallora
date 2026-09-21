"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "@/lib/supabase";
import styles from "./register.module.css";
type Club={id:string;name:string;slug:string;short_name:string|null;welcome_text:string|null;primary_color:string|null};
export default function Register(){const s=useMemo(()=>createClient(),[]),[clubs,setClubs]=useState<Club[]>([]),[q,setQ]=useState("");
useEffect(()=>{void s.from("clubs").select("id,name,slug,short_name,welcome_text,primary_color").eq("is_active",true).order("name").then(({data})=>setClubs((data??[])as Club[]));},[s]);const shown=clubs.filter(c=>c.name.toLowerCase().includes(q.toLowerCase()));
return <main className={styles.page}><div className={styles.shell}><header><Link href="/" className={styles.brand}>RALLORA</Link><Link href="/register-club">Register your club</Link></header><section className={styles.hero}><span>PLAY MORE. BELONG MORE.</span><h1>Find your next league.</h1><p>Search active Rallora clubs, read league details and request to join a team.</p><input aria-label="Search clubs" placeholder="Search by club or town" value={q} onChange={e=>setQ(e.target.value)}/></section><section className={styles.grid}>{shown.map(c=><article key={c.id} className={styles.card}><i style={{background:c.primary_color??"#00b0fe"}}>{c.name[0]}</i><div><small>{c.short_name??"RALLORA CLUB"} · ACTIVE LEAGUE</small><h2>{c.name}</h2><p>{c.welcome_text??"Organiser-approved leagues for local players."}</p><p className={styles.terms}>Review club terms and match-location rules before joining.</p><Link href={"/clubs/"+c.slug+"/register"}>View league & join →</Link></div></article>)}</section>{!shown.length&&<p className={styles.empty}>No active clubs found.</p>}</div></main>}
