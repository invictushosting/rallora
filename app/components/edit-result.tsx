"use client";

import { useId, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import ResultForm, { type ResultValues } from "./result-form";
import styles from "./edit-result.module.css";

type Props = {
  fixtureId: string; homeId: string; awayId: string; homeLabel: string; awayLabel: string;
  onSaved: () => void;
};

// The button is discovery only. The existing RPC checks fixture permissions and
// history locks on every save and recalculates the official standings atomically.
export default function EditResult({ fixtureId, homeId, awayId, homeLabel, awayLabel, onSaved }: Props) {
  const db = useMemo(() => createClient(), []);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [initial, setInitial] = useState<Partial<ResultValues> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false), [saving, setSaving] = useState(false);
  async function open() {
    if (loading || saving) return;
    setError(""); setInitial(null); setLoading(true);
    dialog.current?.showModal();
    try {
      const access = await db.rpc("rallora_can_manage_fixture", { p_fixture_id: fixtureId });
      if (access.error || access.data !== true) throw new Error("Sign in as an organiser for this club to edit this result.");
      const reply = await db.from("results").select("home_score,away_score,winner_team_id,notes").eq("fixture_id", fixtureId).single();
      if (reply.error) throw reply.error;
      setInitial({ home: reply.data.home_score ?? "", away: reply.data.away_score ?? "", winner: reply.data.winner_team_id ?? "draw", notes: reply.data.notes ?? "" });
    } catch (e) { setError(e && typeof e === "object" && "message" in e ? String(e.message) : "Could not load the result. Close and try again."); }
    finally { setLoading(false); }
  }
  async function save(values: ResultValues) {
    setSaving(true);
    try {
      const reply = await db.rpc("rallora_admin_resolve_result", { p_fixture_id: fixtureId, p_home_score: values.home, p_away_score: values.away, p_winner_team_id: values.winner === "draw" ? null : values.winner, p_notes: values.notes || null });
      if (reply.error) throw reply.error;
      dialog.current?.close(); onSaved();
    } finally { setSaving(false); }
  }
  return <>
    <button type="button" className={styles.edit} onClick={() => void open()} disabled={loading || saving} aria-haspopup="dialog" aria-label={`Edit result: ${homeLabel} vs ${awayLabel}`}>Edit result</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={heading} onCancel={event => { if (saving) event.preventDefault(); }}>
      <div className={styles.heading}><h2 id={heading}>Edit result</h2><button type="button" disabled={saving} onClick={() => dialog.current?.close()} aria-label="Close result editor">×</button></div>
      <p className={styles.intro}>Correct the scores below, then review and save. The league table updates automatically.</p>
      {loading ? <p role="status">Loading the latest result…</p> : error ? <p role="alert">{error}</p> : initial && <ResultForm homeId={homeId} awayId={awayId} homeLabel={homeLabel} awayLabel={awayLabel} initial={initial} admin onSave={save}/>}
    </dialog>
  </>;
}
