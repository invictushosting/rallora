"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase";
import { methodByKey } from "@/lib/leagues/payments";
import styles from "./payment-setup.module.css";

type Season = { id: string; name: string; status: string };
const defaults = { enabled: false, amount: "", method: "bank_transfer", instructions: "", refundTerms: "" };

export default function PaymentSetup({ clubName, seasons }: { clubName: string; seasons: Season[] }) {
  const db = useMemo(() => createClient(), []);
  const [seasonId, setSeasonId] = useState("");
  const [draft, setDraft] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [exists, setExists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!seasonId) return;
    let active = true;
    void db.from("rallora_club_entry_fees").select("enabled,amount_pence,method,instructions,refund_terms")
      .eq("season_id", seasonId).maybeSingle().then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setNotice("Could not load the entry fee. Choose the competition again to retry.");
          return;
        }
        setExists(Boolean(data));
        setDraft(data ? { enabled: data.enabled, amount: (data.amount_pence / 100).toFixed(2),
          method: data.method, instructions: data.instructions, refundTerms: data.refund_terms } : defaults);
        setReady(true);
      });
    return () => { active = false; };
  }, [db, seasonId]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!ready || saving || (!exists && !draft.enabled)) return;
    const amount = Math.round(Number(draft.amount) * 100);
    if (draft.enabled && (!/^\d+(\.\d{1,2})?$/.test(draft.amount) || amount < 1 || amount > 100000 ||
        draft.instructions.trim().length < 5 || draft.refundTerms.trim().length < 5)) {
      setNotice("Enter a fee between £0.01 and £1,000, payment instructions and refund terms.");
      return;
    }
    setSaving(true);
    setNotice("");
    const reply = draft.enabled
      ? await db.from("rallora_club_entry_fees").upsert({
          season_id: seasonId, enabled: true, amount_pence: amount, method: draft.method,
          instructions: draft.instructions.trim(), refund_terms: draft.refundTerms.trim(),
        })
      : await db.from("rallora_club_entry_fees").update({ enabled: false }).eq("season_id", seasonId);
    setSaving(false);
    if (reply.error) {
      setNotice("Could not save the entry fee. Refresh and try again.");
      return;
    }
    setExists(true);
    setNotice(draft.enabled ? "Entry fee saved for new pair registrations." : "New pair registrations are free.");
  }

  return <section className={styles.root} aria-labelledby="methods-heading">
    <header className={styles.intro}>
      <h2 id="methods-heading">League entry fees</h2>
      <p>{clubName} collects the fee directly and records payment in Player entries. Existing entries keep the price they registered with.</p>
    </header>
    <div className={styles.content}>
      <form onSubmit={save}>
        <label className={styles.field}>Competition
          <select value={seasonId} disabled={saving} onChange={event => {
            setReady(false); setNotice(""); setSeasonId(event.target.value);
          }}>
            <option value="">Choose a competition</option>
            {seasons.map(season => <option value={season.id} key={season.id}>{season.name} · {season.status}</option>)}
          </select>
        </label>
        {ready && <>
          <label className={styles.confirm}><input type="checkbox" checked={draft.enabled}
            onChange={event => setDraft({ ...draft, enabled: event.target.checked })} /> Charge an entry fee per pair</label>
          {draft.enabled && <>
            <label className={styles.field}>Fee per pair (£)<input required type="number" min="0.01" max="1000" step="0.01"
              value={draft.amount} onChange={event => setDraft({ ...draft, amount: event.target.value })} /></label>
            <label className={styles.field}>Collection method
              <select value={draft.method} onChange={event => setDraft({ ...draft, method: event.target.value })}>
                {["bank_transfer", "cash_at_club"].map(key => <option key={key} value={key}>{methodByKey(key)?.label}</option>)}
              </select>
            </label>
            <label className={styles.field}>Payment instructions for registered pairs
              <textarea required minLength={5} maxLength={1000} rows={3} value={draft.instructions}
                onChange={event => setDraft({ ...draft, instructions: event.target.value })} />
            </label>
            <label className={styles.field}>Refund and cancellation terms
              <textarea required minLength={5} maxLength={1000} rows={3} value={draft.refundTerms}
                onChange={event => setDraft({ ...draft, refundTerms: event.target.value })} />
            </label>
          </>}
          <button className={styles.copy} disabled={saving || (!exists && !draft.enabled)}>{saving ? "Saving…" : "Save entry fee"}</button>
        </>}
        {notice && <p role="status" className={styles.feedback}>{notice}</p>}
      </form>
    </div>
  </section>;
}
