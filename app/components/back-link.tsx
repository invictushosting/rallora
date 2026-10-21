import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./back-link.module.css";

export default function BackLink({ href, children = "Back to club admin" }: { href: string; children?: ReactNode }) {
  return <Link href={href} className={styles.link}><svg aria-hidden="true" className={styles.icon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7M5 12h14" /></svg><span>{children}</span></Link>;
}
