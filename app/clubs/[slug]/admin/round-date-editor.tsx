"use client";

import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase";
import { formatScheduleDate, savedRoundWindows, validateRoundDateChange, type RoundWindow } from "@/lib/competition-schedule";
import type { EditableFixture, EditableSeason } from "./club-editor";
import styles from "./editor.module.css";
import local from "./round-date-editor.module.css";

type Props = { seasons: EditableSeason[]; fixtures: EditableFixture[]; onSaved: () => void };

export default function RoundDateEditor({ seasons, fixtures, onSaved }: Props) {
  const choices = seasons.filter(s => s.fixture_schedule_mode === "date_window" && fixtures.some(f => f.season_id === s.id));
  const [seasonId, setSeasonId] = useState(choices.find(s => s.status === "active")?.id ?? choices[0]?.id ?? "");
  const [notice, setNotice] = useState("");
  const season = choices.find(s => s.id === seasonId);
  return <details className={local.editor}>
    <summary><strong>Edit round dates</strong></summary>
    <div className={`${styles.form} ${local.content}`}>
      <p>Update the competition finish date and playing rounds together. Outstanding fixture deadlines update when you save.</p>
      <label>Competition round<select value={seasonId} onChange={event => { setSeasonId(event.target.value); setNotice(""); }}>
        {choices.map(s => <option key={s.id} value={s.id}>{s.name} · Round {s.rolling_cycle_number} · {s.status}</option>)}
      </select></label>
      {!season && <p>This tool is available for competitions with fixtures played within a date window.</p>}
      {season && <RoundDates key={`${season.id}-${season.ends_on}-${season.competition_ends_on}-${JSON.stringify(season.round_windows)}`} season={season}
        locked={!["draft", "active"].includes(season.status) || seasons.some(s => s.previous_season_id === season.id)}
        outstanding={fixtures.filter(f => f.season_id === season.id && ["open", "submitted", "disputed"].includes(f.status)).length}
        onSaved={onSaved} onSuccess={setNotice} />}
      {notice && <p className={local.notice} role="status">{notice}</p>}
    </div>
  </details>;
}

function RoundDates({ season, locked, outstanding, onSaved, onSuccess }: { season: EditableSeason; locked: boolean; outstanding: number; onSaved: () => void; onSuccess: (message: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const plan = savedRoundWindows(season.round_windows);
  const index = plan.findIndex(w => w.starts_on === season.starts_on && w.ends_on === season.ends_on);
  const roundNumber = index >= 0 ? index + 1 : season.rolling_cycle_number;
  const originalFinish = season.competition_ends_on ?? plan.at(-1)?.ends_on ?? season.ends_on ?? "";
  const [finish, setFinish] = useState(originalFinish);
  const [deadline, setDeadline] = useState(season.ends_on ?? "");
  const [future, setFuture] = useState<RoundWindow[]>(index >= 0 ? plan.slice(index + 1) : []);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const error = !finish ? "Choose the overall competition finish date." : validateRoundDateChange(season.starts_on ?? "", season.ends_on ?? "", deadline, plan, future, finish);
  const changed = finish !== originalFinish || deadline !== season.ends_on || JSON.stringify(future) !== JSON.stringify(index >= 0 ? plan.slice(index + 1) : []);

  function edit() { setReviewed(false); setMessage(""); onSuccess(""); }
  function updateFuture(i: number, field: keyof RoundWindow, value: string) {
    setFuture(windows => windows.map((w, n) => n === i ? { ...w, [field]: value } : w));
    edit();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || busy || error || !reviewed || !changed) return;
    setBusy(true); setMessage("");
    try {
      const { data, error: failure } = await supabase.rpc("rallora_update_competition_schedule", {
        p_season_id: season.id, p_expected_ends_on: season.ends_on,
        p_expected_windows: season.round_windows ?? [], p_expected_competition_ends_on: season.competition_ends_on,
        p_ends_on: deadline, p_future_windows: future, p_competition_ends_on: finish,
      });
      if (failure) throw failure;
      onSuccess(`Schedule saved. Competition finishes on ${formatScheduleDate(finish)}. ${Number(data?.fixtures_updated ?? 0)} outstanding fixture deadlines updated.`);
      setReviewed(false); onSaved();
    } catch (failure) {
      setMessage(failure && typeof failure === "object" && "message" in failure ? String(failure.message) : "Could not save the dates. Please try again.");
    } finally { setBusy(false); }
  }

  return <form className={`${styles.form} ${local.datesForm}`} onSubmit={save}>
    {locked ? <p>This round is complete or its next round has already been prepared. Its schedule is locked.</p> : <>
      <div className={local.finish}>
        <label>Competition finishes<input type="date" required disabled={busy} min={season.starts_on ?? undefined} value={finish} onChange={event => { setFinish(event.target.value); edit(); }} /></label>
        <p>Set the finish date for the whole competition. The final round must end on this date. Extend it here when moving rounds into another month.</p>
      </div>
      <div className={local.round} role="group" aria-labelledby={`current-round-${season.id}`}>
        <h4 id={`current-round-${season.id}`}>Round {roundNumber}<small>Current round</small></h4>
        <label>Round {roundNumber} starts (fixed)<input type="date" readOnly value={season.starts_on ?? ""} /></label>
        <label>Round {roundNumber} deadline<input type="date" required disabled={busy} min={season.starts_on ?? undefined} max={finish || undefined} value={deadline} onChange={event => { setDeadline(event.target.value); edit(); }} /></label>
      </div>
      {future.map((w, i) => <div className={local.round} role="group" aria-labelledby={`future-round-${season.id}-${i}`} key={i}>
        <h4 id={`future-round-${season.id}-${i}`}>Round {roundNumber + i + 1}</h4>
        <label>Round {roundNumber + i + 1} starts<input type="date" required disabled={busy} max={finish || undefined} value={w.starts_on} onChange={event => updateFuture(i, "starts_on", event.target.value)} /></label>
        <label>Round {roundNumber + i + 1} deadline<input type="date" required disabled={busy} max={finish || undefined} value={w.ends_on} onChange={event => updateFuture(i, "ends_on", event.target.value)} /></label>
      </div>)}
      <p>{outstanding} outstanding fixture{outstanding === 1 ? "" : "s"} will use the round {roundNumber} deadline. Existing results, bookings and division placements stay in place. A shorter deadline must still include every recorded booking and proposed match time.</p>
      {!plan.length && <p>This competition has no saved round plan. Set the next round’s dates when you prepare it.</p>}
      <p>Reminder checks use the updated match deadlines. Saving does not send an announcement or prepare promotions; tell players about the change separately.</p>
      {error && <p role="alert">{error}</p>}
      <label className={local.review}><input type="checkbox" checked={reviewed} disabled={busy || Boolean(error) || !changed} onChange={event => setReviewed(event.target.checked)} /> I have checked the competition finish date and all round dates.</label>
      <button type="submit" disabled={busy || Boolean(error) || !reviewed || !changed}>{busy ? "Saving dates…" : "Save round dates"}</button>
    </>}
    {message && <p role="status">{message}</p>}
  </form>;
}
