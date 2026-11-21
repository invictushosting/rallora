"use client";

import { useEffect, useRef, useState } from "react";
import type { createClient } from "@/lib/supabase";
import StripeEntryCheckout from "@/app/components/stripe-entry-checkout";
import { entryPaymentStatusLabel, formatEntryFee, methodByKey, type EntryPayment } from "@/lib/leagues/payments";
import styles from "./account.module.css";

type Payment = EntryPayment & {
  application_id: string;
  season_name: string;
  club_name: string;
  entry_status: string;
};

export default function LeagueEntryPayments({ db }: { db: ReturnType<typeof createClient> }) {
  const section = useRef<HTMLElement>(null);
  const [payments, setPayments] = useState<Payment[]|null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const params = new URLSearchParams(window.location.search);
    const checkingEntry = params.get("stripe") === "return" ? params.get("entry") : null;

    async function load(remaining: number) {
      const { data, error } = await db.rpc("rallora_my_entry_payments");
      if (!active) return;
      setFailed(Boolean(error));
      if (error) return;
      const entries = data as Payment[];
      setPayments(entries);
      if (remaining > 0 && checkingEntry && entries.some(entry =>
        entry.application_id === checkingEntry && entry.status === "awaiting_payment")) {
        timeout = setTimeout(() => void load(remaining - 1), 2_000);
      }
    }

    void load(15);
    return () => { active = false; clearTimeout(timeout); };
  }, [db]);

  useEffect(() => {
    if (window.location.hash === "#league-payments") section.current?.scrollIntoView();
  }, []);

  return <section ref={section} id="league-payments" className={styles.passwordSection} aria-labelledby="league-payments-heading">
    <h2 id="league-payments-heading">League entry payments</h2>
    {failed ? <p role="alert">Could not load your entry payments. Refresh to try again.</p>
      : !payments ? <p role="status">Loading payments…</p>
        : payments.length === 0 && <p>No entry fees to show.</p>}
    {payments?.map(payment => <article className={styles.profileCard} key={payment.application_id}>
      <h3>{payment.season_name} · {payment.club_name}</h3>
      <p><strong>{formatEntryFee(payment.amount_pence)} per pair · {payment.status === "awaiting_payment" && payment.entry_status !== "pending" ? "Payment unrecorded" : entryPaymentStatusLabel[payment.status]}</strong></p>
      {payment.entry_status === "pending" && payment.status === "awaiting_payment" && <>
        <p>{methodByKey(payment.method)?.label}</p>
        <p style={{ whiteSpace: "pre-wrap" }}>{payment.instructions}</p>
        <p>Payment reference {payment.payment_reference}</p>
        {payment.method === "stripe_connect" && <StripeEntryCheckout entry={payment.application_id}/>}
      </>}
      <details><summary>Refund and cancellation terms</summary>
        <p style={{ whiteSpace: "pre-wrap" }}>{payment.refund_terms}</p>
      </details>
    </article>)}
  </section>;
}
