"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import RalloraLogo from "./rallora-logo";
import styles from "./recovery-screen.module.css";

export default function RecoveryScreen({notFound=false,retry}:{notFound?:boolean;retry?:()=>void}){
  const pathname=usePathname();
  const clubSegment=pathname?.match(/^\/clubs\/([^/]+)/)?.[1];
  // Keep recovery inside the current club; never accept an external return URL.
  let clubHref:string|undefined;
  if(clubSegment){
    try{clubHref=`/clubs/${encodeURIComponent(decodeURIComponent(clubSegment))}`}
    catch{clubHref=undefined}
  }
  return <main className={styles.page}>
    <section className={styles.card} aria-labelledby="recovery-heading">
      <Link href="/" aria-label="Rallora home" className={styles.brand}><RalloraLogo variant="light" width={190}/></Link>
      <p className={styles.eyebrow}>{notFound?"PAGE NOT FOUND":"LET’S GET YOU BACK ON COURT"}</p>
      <h1 id="recovery-heading">You hit a Double Fault!</h1>
      <p className={styles.message}>{notFound?"We couldn’t find this page. The link may be incomplete or the page may have moved.":"We couldn’t load this page. Try again, or return to your club and pick up from there."}</p>
      <nav className={styles.actions} aria-label="Page recovery">
        {retry&&<button type="button" onClick={retry}>Try again</button>}
        {clubHref&&<Link href={clubHref}>Back to club</Link>}
        <Link href="/">Rallora home</Link>
      </nav>
      {!notFound&&<p className={styles.note}>If you were saving a change, check its status before submitting it again.</p>}
    </section>
  </main>;
}
