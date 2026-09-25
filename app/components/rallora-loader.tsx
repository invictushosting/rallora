import styles from "../loading.module.css";

export default function RalloraLoader({ overlay=false }: { overlay?: boolean }) {
  return (
    <div className={overlay ? styles.overlay : styles.screen} role="status" aria-live="polite" aria-label="Loading Rallora">
      <div className={styles.loaderCard}>
        <div className={styles.racketWrap} aria-hidden="true">
          <div className={styles.racket}>
            <div className={styles.face}>
              <div className={styles.bridge} />
            </div>
            <div className={styles.handle}>
              <span />
            </div>
          </div>
        </div>
        <p className={styles.kicker}>RALLORA</p>
        <h1>Warming up the glass…</h1>
        <p className={styles.quip}>One quick rally and we’ll have you back on court.</p>
      </div>
    </div>
  );
}
