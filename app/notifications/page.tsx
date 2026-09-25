"use client";

import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import {createClient} from "@/lib/supabase";
import RalloraLogo from "@/app/components/rallora-logo";
import styles from "./notifications.module.css";

type Notification={id:string;title:string;body:string;action_url:string|null;read_at:string|null;created_at:string};

export default function NotificationsPage(){
  const supabase=useMemo(()=>createClient(),[]),[items,setItems]=useState<Notification[]>([]);
  const [state,setState]=useState("Loading notifications…");
  const load=useCallback(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){setState("Sign in to view your notifications.");return}const {data,error}=await supabase.from("rallora_notifications").select("id,title,body,action_url,read_at,created_at").order("created_at",{ascending:false}).limit(100);if(error){setState(error.message);return}setItems((data??[])as Notification[]);setState("")},[supabase]);
  useEffect(()=>{void load()},[load]);
  async function markRead(id:string){const {error}=await supabase.rpc("rallora_mark_notification_read",{p_notification_id:id});if(error){setState(error.message);return}setItems(current=>current.map(item=>item.id===id?{...item,read_at:new Date().toISOString()}:item))}
  return <main className={styles.page}><div className={styles.shell}><header><Link className={styles.brand} href="/" aria-label="Rallora home"><RalloraLogo variant="light" width={164}/></Link><div className={styles.headerActions}><Link href="/platform">← Platform admin</Link><span>YOUR UPDATES</span></div></header><section className={styles.hero}><small>NOTIFICATIONS</small><h1>Stay on top of your league.</h1><p>Registration decisions, captain actions and club updates appear here.</p></section>{state&&<p className={styles.notice}>{state}</p>}<section className={styles.list}>{items.map(item=><article className={item.read_at?styles.read:styles.unread} key={item.id}><div><small>{new Date(item.created_at).toLocaleString("en-GB")}</small><h2>{item.title}</h2><p>{item.body}</p>{item.action_url&&<Link href={item.action_url}>Open update →</Link>}</div>{!item.read_at&&<button onClick={()=>void markRead(item.id)}>Mark read</button>}</article>)}{!state&&!items.length&&<p className={styles.notice}>No notifications yet.</p>}</section></div></main>;
}
