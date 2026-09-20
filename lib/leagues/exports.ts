/**
 * Read-only exports from public, already-published club fixtures and results.
 * These do not submit scores, sync external systems, or expose member contacts.
 */
export type ExportFixture = {
  id: string;
  division: string;
  home: string;
  away: string;
  playBy: string;
  week: number;
  court: string | null;
  score?: string;
};

export function safeCsvCell(value: unknown): string {
  let text = String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  // Prevent Excel/Sheets formula execution from club and player supplied names.
  // Check whitespace as well as direct formula prefixes; keep the visible text.
  if (/^\s*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function makeResultsCsv(
  club: string, season: string, matches: ExportFixture[],
): string {
  const columns = ["Club", "Season", "Division", "Week",
    "Home team", "Away team", "Confirmed score", "Play-by deadline", "Court", "Fixture ID"];
  const rows = matches.map(f => [
    club, season, f.division, f.week,
    f.home, f.away, f.score ?? "", f.playBy, f.court ?? "", f.id,
  ]);
  return "\ufeff" + [columns, ...rows]
    .map(fields => fields.map(safeCsvCell).join(",")).join("\r\n") + "\r\n";
}

function isoDate(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(date + "T00:00:00Z");
  if (Number.isNaN(d.valueOf()) || d.toISOString().slice(0, 10) !== date) return null;
  return d;
}

function icsText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n").replaceAll("\n", "\\n")
    .replaceAll(",", "\\,").replaceAll(";", "\\;");
}

/** Fold by UTF-8 *bytes*, including the one-byte ICS continuation prefix. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const segments: string[] = [];
  let part = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) {
      segments.push(part);
      part = " ";
      bytes = 1;
    }
    part += char;
    bytes += size;
  }
  segments.push(part);
  return segments.join("\r\n");
}

export function makeFixtureDeadlineIcs(
  club: string, season: string, slug: string,
  baseUrl: string, matches: ExportFixture[], now = new Date(),
): string {
  const stamped = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const base = baseUrl.replace(/\/$/, "");
  const calendar: string[] = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rallora//League fixture deadlines//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:" + icsText(club + " " + season + " fixture deadlines"),
  ];
  for (const f of matches) {
    const deadline = isoDate(f.playBy);
    if (!deadline) continue;
    const next = new Date(deadline.getTime() + 86_400_000);
    const start = f.playBy.replaceAll("-", "");
    const end = next.toISOString().slice(0, 10).replaceAll("-", "");
    const summary = `Play-by deadline: ${f.home} vs ${f.away}`;
    const description = `${club} · ${season} · ${f.division}` +
      (f.week ? ` · Week ${f.week}` : "") +
      (f.court ? ` · ${f.court}` : "") +
      "\nThis is the PLAY-BY DEADLINE, not a confirmed match booking or start time." +
      `\nLeague: ${base}/clubs/${encodeURIComponent(slug)}`;
    const values = [
      "BEGIN:VEVENT", "UID:" + icsText(f.id + "." + slug + "@rallora"),
      "DTSTAMP:" + stamped, "DTSTART;VALUE=DATE:" + start,
      "DTEND;VALUE=DATE:" + end,
      "SUMMARY:" + icsText(summary),
      "DESCRIPTION:" + icsText(description),
      "END:VEVENT",
    ];
    calendar.push(...values);
  }
  calendar.push("END:VCALENDAR");
  return calendar.map(fold).join("\r\n") + "\r\n";
}
