"use client";
import { monthlyRounds, formatScheduleDate, validateRoundWindows, dayAfter, type RoundWindow, type RoundCadence } from "@/lib/competition-schedule";
import styles from "./editor.module.css";
type Props = {
  start: string; finish: string; cadence: RoundCadence; custom: RoundWindow[]; rolling: boolean; locked: boolean;
  onStart: (value: string) => void; onFinish: (value: string) => void; onCadence: (value: RoundCadence) => void; onCustom: (value: RoundWindow[]) => void;
};
export default function CompetitionSchedule(p: Props) {
  const windows = p.rolling ? p.cadence === "monthly" ? monthlyRounds(p.start, p.finish) : p.custom : p.start && p.finish ? [{ starts_on: p.start, ends_on: p.finish }] : [];
  const error = p.start && p.finish ? validateRoundWindows(windows, p.start, p.finish) : "";
  function update(index: number, field: keyof RoundWindow, value: string) {
    p.onCustom(windows.map((w, i) => i === index ? { ...w, [field]: value } : w));
  }
  return <div className={styles.schedulePlanner}>
    <h4>When will this competition run?</h4>
    <p>Competition dates cover the whole league. Each playing round has its own deadline.</p>
    {p.locked && <p role="note">Fixtures already exist. These dates are protected here; use the fixture tools to manage the current round.</p>}
    <div className={styles.scheduleDates}>
      <label>Competition starts<input type="date" value={p.start} disabled={p.locked} onChange={e => p.onStart(e.target.value)} /></label>
      <label>Competition finishes<input type="date" value={p.finish} min={p.start || undefined} disabled={p.locked} onChange={e => p.onFinish(e.target.value)} /></label>
    </div>
    {p.rolling && <label>How long do teams have for each round?<select value={p.cadence} disabled={p.locked} onChange={e => {
      const mode = e.target.value as RoundCadence;
      if (mode === "custom" && !p.custom.length) p.onCustom(windows.length ? windows : [{ starts_on: p.start, ends_on: p.finish }]);
      p.onCadence(mode);
    }}><option value="monthly">One month per round</option><option value="custom">Choose the dates for each round</option></select></label>}
    {p.rolling && p.cadence === "custom" && <div className={styles.customRounds}>
      {windows.map((w, index) => <div key={index} className={styles.scheduleRound}><strong>Round {index + 1}</strong><label>Round {index + 1} starts<input type="date" value={w.starts_on} disabled={p.locked} onChange={e => update(index, "starts_on", e.target.value)} /></label><label>Round {index + 1} deadline<input type="date" value={w.ends_on} disabled={p.locked} onChange={e => update(index, "ends_on", e.target.value)} /></label><button type="button" disabled={p.locked || windows.length === 1} onClick={() => p.onCustom(windows.filter((_, i) => i !== index))}>Remove round {index + 1}</button></div>)}
      <button type="button" disabled={p.locked || windows.length >= 120} onClick={() => { const end = windows.at(-1)?.ends_on; p.onCustom([...windows, { starts_on: end ? dayAfter(end) : p.start, ends_on: p.finish }]); }}>Add playing round</button>
    </div>}
    {error && <p className={styles.scheduleError} role="status">{error}</p>}
    {!error && windows.length > 0 && <div className={styles.schedulePreview}><strong>Your playing schedule · {windows.length} round{windows.length === 1 ? "" : "s"}</strong><ol>{windows.map((w, i) => <li key={`${w.starts_on}-${i}`}><span>Round {i + 1}</span><strong>{formatScheduleDate(w.starts_on)} to {formatScheduleDate(w.ends_on)}</strong><small>{i < windows.length - 1 ? "Review results, apply promotion/relegation, then activate the next round." : "Final round. Review results and finish the competition."}</small></li>)}</ol></div>}
    {p.rolling && <p className={styles.scheduleExplanation}>With four pairs in a box, each pair plays three matches per round when everyone plays once. Captains choose match times inside that round’s window. Rallora prepares promotions and new fixtures when the organiser requests the next round; your club checks and activates it. Dates do not trigger an automatic rollover.</p>}
  </div>;
}
