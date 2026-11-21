"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase";
import styles from "./account.module.css";

type Preference = { status: "off" } | { status: "active"; phone: string } |
  { status: "pending"; phone: string; code: string };

export default function WhatsAppPreferences({ db, sender }: { db: ReturnType<typeof createClient>; sender: string }) {
  const section = useRef<HTMLElement>(null);
  const [preference, setPreference] = useState<Preference|null>(null);
  const [number, setNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const update = useCallback(async (action: "read" | "request" | "stop", phone?: string) => {
    setBusy(true);
    setNotice("");
    const { data, error } = await db.rpc("rallora_whatsapp_preference", {
      p_action: action, p_phone: phone ?? null,
    });
    if (error) setNotice("Could not update your WhatsApp preference. Please try again.");
    else {
      setPreference(data as Preference);
      if (action === "stop") {
        setConsent(false);
        setNotice("WhatsApp reminders are off.");
      } else if (action === "read" && data.status === "pending") {
        setNotice("Waiting for your confirmation message.");
      }
    }
    setBusy(false);
  }, [db]);

  useEffect(() => { void update("read"); }, [update]);

  useEffect(() => {
    if (window.location.hash === "#whatsapp-reminders") section.current?.scrollIntoView();
  }, []);

  function request(event: FormEvent) {
    event.preventDefault();
    const phone = number.replace(/[\s()-]/g, "");
    if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) {
      setNotice("Enter your number with the country code, for example +447700900000.");
      return;
    }
    if (consent) void update("request", phone);
  }

  return <section ref={section} id="whatsapp-reminders" className={styles.passwordSection} aria-labelledby="whatsapp-heading">
    <h2 id="whatsapp-heading">WhatsApp reminders</h2>
    <p>Get reminders from Rallora about arranging fixtures, upcoming matches and outstanding results when your club enables WhatsApp.</p>
    {preference?.status === "active" && <>
      <p>Reminders are on for {preference.phone}. Turn them off here or reply STOP in WhatsApp.</p>
      <button type="button" disabled={busy} onClick={() => void update("stop")}>Turn off WhatsApp reminders</button>
    </>}
    {preference?.status === "pending" && <>
      <p>Open WhatsApp and send the prefilled message from {preference.phone} within 15 minutes. Then return here and check the connection.</p>
      <p><a className={styles.returnLink} href={`https://wa.me/${sender.slice(1)}?text=${encodeURIComponent(`JOIN ${preference.code}`)}`}
        target="_blank" rel="noopener noreferrer">Open WhatsApp to confirm</a></p>
      <button type="button" disabled={busy} onClick={() => void update("read")}>Check connection</button>{" "}
      <button type="button" disabled={busy} onClick={() => void update("stop")}>Cancel setup</button>
    </>}
    {preference?.status === "off" && <form onSubmit={request}>
      <label>WhatsApp number with country code
        <input required type="tel" maxLength={25} placeholder="+44…" value={number} onChange={event => setNumber(event.target.value)} />
      </label>
      <fieldset className={styles.preferencesFieldset}><label className={styles.clubChoice}>
        <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
        <span>I want Rallora to send league reminders to this number via WhatsApp.</span>
      </label></fieldset>
      <button disabled={busy || !consent}>Continue to WhatsApp</button>
    </form>}
    {!preference && notice && <button type="button" disabled={busy} onClick={() => void update("read")}>Retry</button>}
    {notice && <p role="status" className={styles.message}>{notice}</p>}
  </section>;
}
