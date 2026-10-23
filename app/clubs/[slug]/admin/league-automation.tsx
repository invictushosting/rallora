"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase";
import type { EditableFixture, EditableSeason } from "./club-editor";
import { savedRoundWindows, nextPlannedRound, formatScheduleDate } from "@/lib/competition-schedule";
import styles from "./editor.module.css";

type Props = { seasons: EditableSeason[]; fixtures: EditableFixture[]; slug: string; onSaved: () => void };

export default function LeagueAutomation({ seasons, fixtures, slug, onSaved }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [startsOn, setStartsOn] = useState<string | null>(null);
  const [endsOn, setEndsOn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [finishDate,setFinishDate]=useState("");
  const season = seasons.find(item => item.id === seasonId);
  const existing = fixtures.filter(item => item.season_id === seasonId);
  const successor = seasons.find(item => item.previous_season_id === seasonId);
  const nextCycle = existing.length > 0 && season?.league_format === "promotion_relegation_cycles";
  const plan = savedRoundWindows(season?.round_windows);
  const planned = nextPlannedRound(plan, nextCycle ? season?.ends_on : null);
  const startValue = startsOn ?? planned?.starts_on ?? (!nextCycle ? season?.starts_on : "") ?? "";
  const endValue = endsOn ?? planned?.ends_on ?? (!nextCycle ? season?.ends_on : "") ?? "";
  const finished = Boolean(nextCycle && season?.competition_ends_on && season.ends_on && season.ends_on >= season.competition_ends_on);
  const legs = season?.cycle_match_mode === "double_round_robin" ? 2 : 1;
  const expected = season?.divisions.reduce((sum, division) => sum + division.teams.length * (division.teams.length - 1) / 2 * legs, 0) ?? 0;
  const rounds = Math.max(0, ...(season?.divisions.map(division => (division.teams.length - (division.teams.length % 2 === 0 ? 1 : 0)) * legs) ?? []));
  const canGenerate = Boolean(season && !finished && !successor && !season.registration_published && season.divisions.length && season.divisions.every(division => division.teams.length >= 2) && (nextCycle ? ["active", "completed"].includes(season.status) : existing.length === 0 && ["draft", "active"].includes(season.status)));

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canGenerate || busy) return;
    const fields = new FormData(event.currentTarget);
    const start = String(fields.get("starts_on") ?? "");
    const end = String(fields.get("ends_on") ?? "");
    if (!start || !end || end < start || Boolean(season?.competition_ends_on && end>season.competition_ends_on)) { setMessage("Choose a valid start and end date."); return; }
    setBusy(true); setMessage(""); setCreatedId("");
    try {
      const { data, error } = await supabase.rpc(nextCycle ? "rallora_create_next_cycle" : "rallora_generate_round_robin", {
        p_season_id: seasonId, p_starts_on: start, p_ends_on: end,
      });
      if (error) throw error;
      const result = data as { season_id: string; fixture_count: number; teams_carried?: number; promoted?: number; relegated?: number };
      setMessage(nextCycle
        ? `Next cycle prepared as a private draft: ${result.teams_carried} pairings, ${result.promoted} promoted, ${result.relegated} relegated and ${result.fixture_count} fixtures. Review it before activation.`
        : `${result.fixture_count} fixtures generated. Review the schedule before activating the competition.`);
      setCreatedId(result.season_id);
      onSaved();
    } catch (error) {
      setMessage(error && typeof error === "object" && "message" in error ? String(error.message) : "Could not generate fixtures. Please try again.");
    } finally { setBusy(false); }
  }

  return <form className={styles.form} onSubmit={generate}>
    <div className={styles.wide}><h3>Fixtures & playing rounds</h3><p>Schedule every pairing against each opponent. Odd-sized divisions receive a bye each round.</p></div>
    <label className={styles.wide}>Competition<select value={seasonId} onChange={event => { setSeasonId(event.target.value); setStartsOn(null); setEndsOn(null); setFinishDate(""); setMessage(""); setCreatedId(""); }}>
      {seasons.map(item => <option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}
    </select></label>
    {season && <div className={styles.wide}>
      <p>{season.cycle_match_mode === "double_round_robin" ? "Home and away" : "Single round-robin"} · {season.divisions.length} division{season.divisions.length === 1 ? "" : "s"} · {existing.length ? `${existing.length} existing fixtures` : `${expected} fixtures to generate`}.</p>
      {nextCycle && <p>The final table decides movement: {season.promotion_places} up and {season.relegation_places} down, except at the top and bottom divisions. Ties use points, wins, score difference, then pairing name. Pairings and captain access carry into a new private draft. Previous fixtures and results are then locked as history.</p>}
      {nextCycle && !season.require_cycle_completion && <p>This competition allows an unfinished cycle to close. Unplayed fixtures will be left behind; submitted and disputed results must still be resolved first.</p>}
      {season.registration_published && <p>Close registration before generating fixtures.</p>}
      {successor && <p>The next cycle has already been prepared: {successor.name}.</p>}
      {!nextCycle && existing.length > 0 && <p>This competition already has fixtures. Use the schedule tools below to manage them.</p>}
      {nextCycle && season.status === "draft" && <p>Activate and play this cycle before preparing its successor.</p>}
      {season.fixture_schedule_mode === "weekly" && <p>Allow at least {rounds * 7} days for {rounds} weekly rounds.</p>}
    </div>}
    {plan.length > 0 && <div className={`${styles.wide} ${styles.schedulePreview}`}><strong>Saved competition schedule</strong><p>{plan.length} playing rounds · competition finishes {formatScheduleDate(season?.competition_ends_on ?? plan.at(-1)!.ends_on)}.</p>{planned && <p><strong>{nextCycle ? "Next round" : "First round"}:</strong> {formatScheduleDate(planned.starts_on)} to {formatScheduleDate(planned.ends_on)}. These dates come from your competition setup.</p>}<p>After each round, resolve results, prepare the next round, then review and activate it. Promotion/relegation is applied when you prepare that next round.</p></div>}
    {finished && <p className={styles.wide} role="status">This is the final round. Review the results and complete the competition; no further round can be created after the overall finish date.</p>}
    {season && !plan.length && <div className={styles.wide}><h3>Competition finish date</h3><p>{season.competition_ends_on?`This league finishes on ${season.competition_ends_on}. No fixture cycle can run past this date.`:"Set the final date for the entire rolling league, separate from this cycle’s window."}</p><label>Overall finish<input type="date" disabled={busy||Boolean(successor)} value={finishDate||season.competition_ends_on||""} onChange={e=>setFinishDate(e.target.value)}/></label><button type="button" disabled={busy||!finishDate||Boolean(successor)} onClick={async()=>{setBusy(true);const result=await supabase.from("seasons").update({competition_ends_on:finishDate}).eq("id",season.id);setMessage(result.error?result.error.message:"Competition finish date saved.");setBusy(false);if(!result.error){setFinishDate("");onSaved();}}}>Save finish date</button></div>}
    <label>{nextCycle ? "Next round starts" : "First round starts"}<input name="starts_on" type="date" max={season?.competition_ends_on??undefined} required disabled={busy} min={nextCycle && season?.ends_on ? new Date(new Date(`${season.ends_on}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0,10) : undefined} value={startValue} readOnly={Boolean(planned)} onChange={event => setStartsOn(event.target.value)} /></label>
    <label>{nextCycle ? "Next round deadline" : "First round deadline"}<input name="ends_on" type="date" max={season?.competition_ends_on??undefined} required disabled={busy} min={startsOn || undefined} value={endValue} readOnly={Boolean(planned)} onChange={event => setEndsOn(event.target.value)} /></label>
    <button type="submit" disabled={busy || !canGenerate}>{busy ? "Preparing fixtures…" : nextCycle ? "Prepare next round" : "Generate all fixtures"}</button>
    {message && <p className={styles.wide} role="status">{message}</p>}
    {createdId && <Link className={styles.wide} href={`/clubs/${slug}/admin/preview/${createdId}`}>Review competition →</Link>}
  </form>;
}
