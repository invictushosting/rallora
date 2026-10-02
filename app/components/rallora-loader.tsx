import Image from "next/image";
import styles from "../loading.module.css";

export default function RalloraLoader({ overlay=false }: { overlay?: boolean }) {
  return (
    <div className={overlay ? styles.overlay : styles.screen} role="status" aria-live="polite" aria-label="Loading Rallora">
      <div className={styles.loaderCard}>
        <div className={styles.brandMark} aria-hidden="true">
          <span className={styles.motionRing} />
          <Image
            src="/brand/rallora-brandmark-light.svg"
            alt=""
            width={150}
            height={150}
            priority
            className={styles.masterMark}
          />
        </div>
        <Image
          src="/brand/rallora-logo-light.svg"
          alt="Rallora"
          width={245}
          height={58}
          priority
          className={styles.wordmark}
        />
        <h1>Warming up the glass…</h1>
        <p className={styles.quip}>One quick rally and we’ll have you back on court.</p>
        <span className={styles.loadingLine} aria-hidden="true"><i /></span>
      </div>
    </div>
  );
}
