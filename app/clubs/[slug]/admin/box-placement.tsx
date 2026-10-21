"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { EditableSeason } from "./club-editor";
import styles from "./editor.module.css";

type Props = { seasons: EditableSeason[]; onSaved: () => void };
export default function BoxPlacement({ seasons, onSaved }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [seasonId, setSeasonId] = useState(seasons.find(s => s.status === "draft")?.id ?? "");
  const [teamId, setTeamId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [swapId, setSwapId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmSeed, setConfirmSeed] = useState(false);
  const season = seasons.find(s => s.id === seasonId && s.status === "draft");
  const divisions = season?.divisions ?? [];
  const source = divisions.find(d => d.teams.some(t => t.id === teamId));
  const destination = divisions.find(d => d.id === divisionId);
  const full = Boolean(destination && destination.teams.length >= (season?.teams_per_division ?? 100));
  async function place(seed: boolean) {
    if (!season || busy) return;
    setBusy(true); setMessage("");
    try {
      const { data, error } = await supabase.rpc("rallora_place_draft_boxes", {
        p_season_id: season.id, p_seed: seed, p_team_id: seed ? null : teamId,
        p_division_id: seed ? null : divisionId, p_swap_team_id: seed ? null : swapId || null,
      });
      if (error) throw error;
      setMessage(`${seed ? "Pairings placed by combined rating. Review and tweak the boxes below." : "Box placement updated."} ${data.fixtures_cleared ? "Previous draft fixtures were cleared. Generate fixtures again before activation." : "Generate fixtures after finalising the boxes."}`);
      setTeamId(""); setDivisionId(""); setSwapId(""); setConfirmSeed(false); onSaved();
    } catch (error) { setMessage(error && typeof error === "object" && "message" in error ? String(error.message) : "Could not update boxes."); }
    finally { setBusy(false); }
  }
  return <section className={styles.form}>
    <div className={styles.wide}><h3>Starting boxes & manual adjustments</h3><p>Approve pairings first, then place the highest combined Playtomic ratings in the top box. Synced ratings take priority over entered ratings. Both players need a rating. Clubs can move or swap pairings while the cycle is a draft.</p><p>Changing boxes clears untouched draft fixtures. Finish your adjustments, generate fixtures, then activate. Active cycles use results for promotion and relegation.</p></div>
    <label className={styles.wide}>Draft cycle<select value={seasonId} disabled={busy} onChange={e => { setSeasonId(e.target.value); setTeamId(""); setDivisionId(""); setSwapId(""); setConfirmSeed(false); setMessage(""); }}><option value="">Choose draft cycle</option>{seasons.filter(s => s.status === "draft").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {season && !season.previous_season_id && <div className={styles.wide}>{confirmSeed ? <><p>This replaces the current starting order, including manual tweaks, using combined ratings.</p><button type="button" disabled={busy} onClick={() => void place(true)}>Confirm rating placement</button> <button type="button" disabled={busy} onClick={() => setConfirmSeed(false)}>Cancel</button></> : <button type="button" disabled={busy || !divisions.some(d => d.teams.length)} onClick={() => setConfirmSeed(true)}>Place initial boxes by combined rating</button>}</div>}
    <label>Pairing to move<select value={teamId} disabled={busy || !season} onChange={e => { setTeamId(e.target.value); setDivisionId(""); setSwapId(""); }}>{<option value="">Choose pairing</option>}{divisions.map(d => <optgroup key={d.id} label={d.name}>{d.teams.map(t => <option key={t.id} value={t.id}>{[t.player_one_name,t.player_two_name].filter(Boolean).join(" / ") || t.name}</option>)}</optgroup>)}</select></label>
    <label>Destination box<select value={divisionId} disabled={busy || !teamId} onChange={e => { setDivisionId(e.target.value); setSwapId(""); }}><option value="">Choose box</option>{divisions.filter(d => d.id !== source?.id).map(d => <option key={d.id} value={d.id}>{d.name} · {d.teams.length} pairings</option>)}</select></label>
    <label className={styles.wide}>Swap with{full ? " (required: destination is full)" : " (optional)"}<select value={swapId} disabled={busy || !divisionId} onChange={e => setSwapId(e.target.value)}><option value="">Move without swapping</option>{destination?.teams.map(t => <option key={t.id} value={t.id}>{[t.player_one_name,t.player_two_name].filter(Boolean).join(" / ") || t.name}</option>)}</select></label>
    <button type="button" disabled={busy || !season || !teamId || !divisionId || (full && !swapId)} onClick={() => void place(false)}>{busy ? "Updating boxes…" : swapId ? "Swap pairings" : "Move pairing"}</button>
    {message && <p className={styles.wide} role="status">{message}</p>}
  </section>;
}
