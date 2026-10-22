"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {useParams,usePathname} from "next/navigation";
import {createClient} from "@/lib/supabase";
import styles from "./super-admin-navigation.module.css";

export default function SuperAdminNavigation(){
  const [allowed,setAllowed]=useState(false);
  const params=useParams();
  const pathname=usePathname();
  const slug=typeof params.slug==="string"?params.slug:"";
  useEffect(()=>{
    const db=createClient();
    let alive=true,version=0,timer:ReturnType<typeof setTimeout>|undefined;
    async function check(){
      const current=++version;
      try{
        const auth=await db.auth.getUser();
        if(auth.error||!auth.data.user){if(alive&&current===version)setAllowed(false);return;}
        const access=await db.rpc("rallora_is_platform_admin");
        if(alive&&current===version)setAllowed(!access.error&&access.data===true);
      }catch{if(alive&&current===version)setAllowed(false);}
    }
    void check();
    const {data}=db.auth.onAuthStateChange(()=>{
      version++;setAllowed(false);
      if(timer)clearTimeout(timer);
      timer=setTimeout(()=>void check(),0);
    });
    return()=>{alive=false;version++;if(timer)clearTimeout(timer);data.subscription.unsubscribe();};
  },[]);
  if(!allowed)return null;
  const base=`/clubs/${encodeURIComponent(slug)}`;
  const links=[{href:"/platform",label:"Super admin dashboard"},...(slug?[
    {href:`${base}/admin`,label:"Club admin"},
    {href:`${base}/captain`,label:"View as captain"},
    {href:base,label:"Public club page"},
    {href:`${base}/register`,label:"Player registration"},
    {href:`${base}/admin/registrations`,label:"Registrations & players"},
    {href:`${base}/admin/reminders`,label:"Reminders"},
    {href:`${base}/admin/staff`,label:"Staff"},
    {href:`${base}/admin/integrations`,label:"Playtomic"},
    {href:`${base}/social`,label:"Social studio"},
    {href:`${base}/events`,label:"Club events"},
  ]:[])];
  return <aside className={styles.bar} aria-label="Super admin access">
    <div className={styles.heading}><strong>SUPER ADMIN</strong><span>{slug?"All club views · Actions save to live club data":"Choose a club from your dashboard to access every view"}</span></div>
    <nav aria-label="Super admin views">{links.map(link=><Link key={link.href} href={link.href} aria-current={pathname===link.href?"page":undefined}>{link.label}</Link>)}</nav>
  </aside>;
}
