"use client";

import { useId, useState, type FormEvent } from "react";
import { resultScores, scoreSets, type SetScore } from "@/lib/leagues/scores";
import MatchScore from "./match-score";
import styles from "./result-form.module.css";

export type ResultValues = { home: string; away: string; winner: string; notes: string };
type Props = {
  homeId: string; awayId: string; homeLabel: string; awayLabel: string; yourTeamId?: string;
  initial?: Partial<ResultValues>; admin?: boolean; disabled?: boolean;
  onSave: (values: ResultValues) => Promise<void>;
};

export default function ResultForm({ homeId, awayId, homeLabel, awayLabel, yourTeamId, initial, admin, disabled, onSave }: Props) {
  const id = useId();
  const [sets, setSets] = useState<SetScore[]>(() => {
    const home = scoreSets(initial?.home), away = scoreSets(initial?.away);
    return Array.from({ length: Math.max(3, home.length, away.length) }, (_, i) => ({ home: home[i] ?? "", away: away[i] ?? "" }));
  });
  const [winner, setWinner] = useState(initial?.winner ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [review, setReview] = useState<ResultValues | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = saving || disabled;
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    try {
      const scores = resultScores(sets);
      if (![homeId, awayId, "draw"].includes(winner)) throw new Error("Choose the winning pairing or Draw.");
      setError(""); setReview({ ...scores, winner, notes: notes.trim() });
    } catch (e) { setError(e instanceof Error ? e.message : "Check the score."); }
  }
  async function save() {
    if (!review || busy) return;
    setSaving(true); setError("");
    try { await onSave(review); }
    catch (e) { setError(e && typeof e === "object" && "message" in e ? String(e.message) : "Could not save the result. Please try again."); }
    finally { setSaving(false); }
  }
  return <form className={styles.form} onSubmit={prepare}>
    {review ? <>
      <h3>Check the result</h3>
      <MatchScore homeLabel={homeLabel} awayLabel={awayLabel} homeScore={review.home} awayScore={review.away} outcome={review.winner === "draw" ? "draw" : review.winner === homeId ? "home" : "away"}/>
      <p>{review.winner === "draw" ? "Draw" : `Winner: ${review.winner === homeId ? homeLabel : awayLabel}`}</p>
      {review.notes && <p>Note: {review.notes}</p>}
      <p className={styles.hint}>{admin ? "Saving replaces the official result and updates the league table." : "Either opposing player will be asked to confirm this result."}</p>
      <div className={styles.actions}><button type="button" disabled={busy} onClick={() => { setReview(null); setError(""); }}>Back to scores</button><button type="button" disabled={busy} onClick={() => void save()}>{saving ? "Saving…" : admin ? "Save corrected result" : "Submit result"}</button></div>
    </> : <>
      <h3>{admin ? "Correct the result" : "Enter the result"}</h3>
      <p className={styles.hint}>Enter each pairing’s games beside their names. Leave unplayed sets blank. Home and away are fixed labels for this fixture.</p>
      <fieldset disabled={busy} className={styles.fields}><legend className={styles.srOnly}>Games in each set</legend>
        <div className={styles.scroll}><table className={styles.entry}><thead><tr><th scope="col">Pairing</th>{sets.map((_, i) => <th scope="col" key={i}>Set {i + 1}</th>)}</tr></thead>
          <tbody>{([{ side: "home", teamId: homeId, label: homeLabel }, { side: "away", teamId: awayId, label: awayLabel }] as const).map(row => <tr key={row.side}>
            <th scope="row"><span className={styles.side}>{row.side}{yourTeamId === row.teamId ? " · Your pairing" : ""}</span>{row.label}</th>
            {sets.map((set, i) => <td key={i}><input aria-label={`${row.side === "home" ? "Home" : "Away"}: ${row.label}, set ${i + 1} games`} type="text" inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} autoComplete="off" value={set[row.side]} onChange={event => { setSets(current => current.map((value, index) => index === i ? { ...value, [row.side]: event.target.value } : value)); }}/></td>)}
          </tr>)}</tbody></table></div>
        <div className={styles.setActions}>{sets.length < 5 && <button type="button" onClick={() => setSets(current => [...current, { home: "", away: "" }])}>Add set</button>}{sets.length > 1 && !sets.at(-1)?.home && !sets.at(-1)?.away && <button type="button" onClick={() => setSets(current => current.slice(0, -1))}>Remove blank set</button>}</div>
        {admin && <div className={styles.setActions}><button type="button" onClick={() => {
          setSets(current => current.map(set => ({ home: set.away, away: set.home })));
          setWinner(current => current === homeId ? awayId : current === awayId ? homeId : current);
        }}>Swap scores between pairings</button></div>}
      </fieldset>
      <fieldset disabled={busy} className={styles.outcomes}><legend>Who won?</legend>{[{ value: homeId, label: `Home · ${homeLabel}` }, { value: awayId, label: `Away · ${awayLabel}` }, { value: "draw", label: "Draw" }].map(option => <label key={option.value}><input type="radio" name={`${id}-winner`} value={option.value} checked={winner === option.value} onChange={() => setWinner(option.value)}/><span>{option.label}</span></label>)}</fieldset>
      <label className={styles.note}>{admin ? "Correction note (optional)" : "Note (optional)"}<textarea disabled={busy} maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)}/></label>
      <button type="submit" disabled={busy}>Review result</button>
    </>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </form>;
}
