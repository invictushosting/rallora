"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { createClient } from "@/lib/supabase";
import styles from "./whatsapp-reminder-prompt.module.css";

export default function WhatsAppReminderPrompt({
  db, clubId, clubSlug,
}: {
  db: ReturnType<typeof createClient>;
  clubId: string;
  clubSlug: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const claim = useRef<PromiseLike<boolean> | null>(null);

  useEffect(() => {
    if (typeof dialog.current?.showModal !== "function") return;
    // Share the claim across effect replays so one visit cannot consume it twice.
    claim.current ??= db.rpc("rallora_claim_whatsapp_prompt", { p_club_id: clubId })
      .then(({ data, error }) => !error && data === true);
    let current = true;
    void claim.current.then(eligible => {
      const element = dialog.current;
      if (current && eligible && element && !element.open) element.showModal();
    });
    return () => { current = false; };
  }, [clubId, db]);

  return <dialog ref={dialog} className={styles.dialog}
    aria-labelledby="whatsapp-prompt-title" aria-describedby="whatsapp-prompt-description">
    <h2 id="whatsapp-prompt-title">Get match reminders on WhatsApp?</h2>
    <p id="whatsapp-prompt-description">
      Rallora can remind you to arrange a match, tell you when it’s coming up, or prompt you to submit a result.
      You can switch reminders off anytime.
    </p>
    <div className={styles.actions}>
      <Link className={styles.primary} href={`/account?club=${encodeURIComponent(clubSlug)}&return=captain#whatsapp-reminders`}
        onClick={() => dialog.current?.close()}>Set up WhatsApp</Link>
      <button type="button" autoFocus onClick={() => dialog.current?.close()}>Maybe later</button>
    </div>
  </dialog>;
}
