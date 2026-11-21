"use client";

import { useEffect, useState } from "react";
import type { createClient } from "@/lib/supabase";
import { formatEntryFee, methodByKey, type EntryPayment } from "@/lib/leagues/payments";
import styles from "./account.module.css";

type Payment = EntryPayment & {
  application_id: string;
  season_name: string;
  club_name: string;
  entry_status: string;
};

export default function LeagueEntryPayments({ db }: { db: ReturnType<typeof createClient> }) {
  const [payments, setPayments] = useState<Payment[]|null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void db.rpc("rallora_my_entry_payments").then(({data,error}) => {
      if (active) {
        setFailed(Boolean(error));
        if (!error) setPayments(data as Payment[]);
      }
    });
    return () => { active = false; };
  }, [db]);

  return <section id="league-payments" className={styles.passwordSection} aria-labelledby="league-payments-heading">
    <h2 id="league-payments-heading">League entry payments</h2>
    {failed ? <p role="alert">Could not load your entry payments. Refresh to try again.</p>
      : !payments ? <p role="status">Loading payments…</p>
        : payments.length === 0 && <p>No entry fees to show.</p>}
    {payments?.map(payment => <article className={styles.profileCard} key={payment.application_id}>
      <h3>{payment.season_name} · {payment.club_name}</h3>
      <p><strong>{formatEntryFee(payment.amount_pence)} per pair · {payment.status === "paid" ? "Paid"
        : payment.status === "refunded" ? "Refunded" : payment.entry_status === "pending" ? "Payment pending" : "Payment unrecorded"}</strong></p>
      {payment.entry_status === "pending" && payment.status === "awaiting_payment" && <>
        <p>{methodByKey(payment.method)?.label}</p>
        <p style={{ whiteSpace: "pre-wrap" }}>{payment.instructions}</p>
        <p>Payment reference {payment.payment_reference}</p>
      </>}
      <details><summary>Refund and cancellation terms</summary>
        <p style={{ whiteSpace: "pre-wrap" }}>{payment.refund_terms}</p>
      </details>
    </article>)}
  </section>;
}
