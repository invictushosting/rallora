"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import styles from "../admin.module.css";

type Integration={
  provider:string;status:string;client_id:string|null;last_verified_at:string|null;
  last_sync_at:string|null;last_error:string|null;updated_at:string;
};

export default function IntegrationsPage(){
  const params=useParams(); const slug=typeof params.slug==="string"?params.slug:"";
  const [integration,setIntegration]=useState<Integration|null>(null);
  const [clientId,setClientId]=useState(""),[secret,setSecret]=useState("");
  const [state,setState]=useState("Loading integration status…"),[error,setError]=useState(""),[busy,setBusy]=useState(false);

  async function load(){
    setError("");
    const r=await fetch(`/api/integrations/playtomic?club=${encodeURIComponent(slug)}`,{cache:"no-store"});
    const body=await r.json().catch(()=>({})) as {integration?:Integration|null;error?:string};
    if(!r.ok){setState("");setError(body.error??"Could not load integrations.");return}
    setIntegration(body.integration??null);
    setClientId(body.integration?.client_id??"");
    setState("");
  }
  useEffect(()=>{if(slug)void load()},[slug]);

  async function connect(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError("");setState("");
    const r=await fetch("/api/integrations/playtomic",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({club:slug,client_id:clientId,client_secret:secret})});
    const body=await r.json().catch(()=>({})) as {error?:string};
    setBusy(false);
    if(!r.ok){setError(body.error??"Could not connect Playtomic.");return}
    setSecret("");setState("Playtomic connected and verified.");await load();
  }

  async function disconnect(){
    if(!window.confirm("Disconnect Playtomic from this Rallora club? Stored credentials will be removed."))return;
    setBusy(true);setError("");setState("");
    const r=await fetch("/api/integrations/playtomic",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({club:slug})});
    const body=await r.json().catch(()=>({})) as {error?:string};
    setBusy(false);
    if(!r.ok){setError(body.error??"Could not disconnect Playtomic.");return}
    setState("Playtomic disconnected.");await load();
  }

  const connected=integration?.status==="connected";
  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.nav}><Link href={`/clubs/${slug}/admin`} className={styles.wordmark}>← Club administration</Link></header>
    <section className={styles.hero}>
      <span className={styles.eyebrow}>INTEGRATIONS</span><h1>Connect Playtomic</h1>
      <p>For Champion and Master clubs. Rallora verifies the credentials server-side and never exposes the Client Secret back to the browser.</p>
    </section>
    {state&&<section className={styles.message}><p>{state}</p></section>}
    {error&&<section className={styles.message}><p>{error}</p></section>}
    <section className={styles.card}>
      <span className={styles.status}>{connected?"connected":integration?.status??"not connected"}</span>
      <h3>Playtomic Club API</h3>
      <p>Generate External API credentials in Playtomic Manager → Settings → Developer Tools, then connect them here.</p>
      {integration&&<div className={styles.numbers}>
        <span><strong>{integration.client_id?"Saved":"—"}</strong> Client ID</span>
        <span><strong>{integration.last_verified_at?new Date(integration.last_verified_at).toLocaleDateString("en-GB"):"—"}</strong> Last verified</span>
        <span><strong>{integration.last_sync_at?new Date(integration.last_sync_at).toLocaleDateString("en-GB"):"—"}</strong> Last sync</span>
      </div>}
      {integration?.last_error&&<p>{integration.last_error}</p>}
      <form className={styles.loginForm} onSubmit={connect}>
        <label>Client ID<input required autoComplete="off" value={clientId} onChange={e=>setClientId(e.target.value)} /></label>
        <label>Client Secret<input required type="password" autoComplete="new-password" value={secret} onChange={e=>setSecret(e.target.value)} /></label>
        <button disabled={busy}>{busy?"Verifying…":connected?"Replace & re-verify credentials":"Connect & verify"}</button>
      </form>
      {connected&&<button disabled={busy} onClick={()=>void disconnect()}>Disconnect Playtomic</button>}
    </section>
  </div></main>;
}
