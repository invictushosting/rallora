import Link from "next/link";
import RalloraLogo from "@/app/components/rallora-logo";
import styles from "./maintenance.module.css";

export const metadata = {
  title: "Rallora | Coming Soon",
  description: "Rallora is getting ready. The smarter way to run padel leagues is coming soon.",
};

export default function MaintenancePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <RalloraLogo variant="light" width={218} />
      </header>
      <section className={styles.hero}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>RALLORA IS GETTING READY</span>
          <h1>The smarter way to run your <span>padel leagues.</span></h1>
          <p>
            We&apos;re putting the finishing touches on Rallora — one connected platform
            for fixtures, results, league tables, captains and club communities.
          </p>
          <div className={styles.actions}>
            <Link href="/pilot" className={styles.primary}>Pilot programme ↗</Link>
            <Link href="/register-club" className={styles.secondary}>Register your club →</Link>
          </div>
          <p className={styles.note}>Launching soon · Built for padel clubs</p>
        </div>
        <div className={styles.court} aria-hidden="true">
          <div className={styles.courtInner}>
            <div className={styles.net} />
            <div className={styles.center} />
          </div>
          <div className={styles.ball} />
          <span>YOUR COURT. YOUR LEAGUE.</span>
        </div>
      </section>
    </main>
  );
}
