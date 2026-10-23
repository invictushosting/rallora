export type RoundWindow = { starts_on: string; ends_on: string };
export type RoundCadence = "monthly" | "custom";
export function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function dayAfter(value: string): string {
  return new Date(Date.parse(`${value}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
}
function monthFrom(start: string, offset: number): string {
  const date = new Date(`${start}T00:00:00Z`);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset + 1, 0)).getUTCDate();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, Math.min(date.getUTCDate(), last))).toISOString().slice(0, 10);
}
export function monthlyRounds(start: string, finish: string): RoundWindow[] {
  if (!isDate(start) || !isDate(finish) || finish < start) return [];
  const windows: RoundWindow[] = [];
  for (let index = 0; index < 120; index++) {
    const next = monthFrom(start, index + 1);
    const end = new Date(Date.parse(`${next}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    windows.push({ starts_on: monthFrom(start, index), ends_on: end > finish ? finish : end });
    if (end >= finish) return windows;
  }
  return [];
}
export function validateRoundWindows(windows: RoundWindow[], start: string, finish: string): string {
  if (!isDate(start) || !isDate(finish) || finish < start) return "Choose a competition start and finish date, with the finish on or after the start.";
  if (!windows.length || windows.length > 120) return "Add between 1 and 120 playing rounds. Monthly plans can cover up to ten years.";
  if (windows[0].starts_on !== start || windows.at(-1)?.ends_on !== finish) return "The first round must start on the competition start date and the final round must end on the competition finish date.";
  for (let i = 0; i < windows.length; i++) {
    const round = windows[i];
    if (!isDate(round.starts_on) || !isDate(round.ends_on) || round.ends_on < round.starts_on || round.starts_on < start || round.ends_on > finish) return `Check the start and deadline for round ${i + 1}.`;
    if (i && round.starts_on <= windows[i - 1].ends_on) return `Round ${i + 1} must start after the previous round ends.`;
  }
  return "";
}
export function formatScheduleDate(value: string): string {
  return isDate(value) ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "Choose date";
}
/** Tolerate legacy rows and never use malformed saved JSON as a fixture window. */
export function savedRoundWindows(value: unknown): RoundWindow[] {
  if (!Array.isArray(value) || !value.length || value.length > 120) return [];
  const valid = value.every(w => w && typeof w.starts_on === "string" && typeof w.ends_on === "string" && isDate(w.starts_on) && isDate(w.ends_on));
  if (!valid) return [];
  return validateRoundWindows(value, value[0].starts_on, value.at(-1).ends_on) ? [] : value;
}
export function nextPlannedRound(windows: RoundWindow[], currentEnd?: string | null): RoundWindow | undefined {
  return currentEnd ? windows.find(w => w.starts_on > currentEnd) : windows[0];
}
