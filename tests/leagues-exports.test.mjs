import test from "node:test";
import assert from "node:assert/strict";
import {
  safeCsvCell, makeResultsCsv, makeFixtureDeadlineIcs,
} from "../lib/leagues/exports.ts";

const entries = [
  { id:"fixture-1", division:"Division 1", home:"Pair O'Brien",
    away:"=HYPERLINK(\"evil\")", week:5, playBy:"2026-09-26",
    court:"Court 2", score:"6-4, 6-3" },
  { id:"fixture-2", division:"Division 2", home:"Pairs 🏆", away:"Pair B",
    week:5, playBy:"2026-09-27", court:null },
];

test("CSV exports only requested results and handles quotation / injection", () => {
  const csv = makeResultsCsv("GSM Padel", "Autumn Cup", entries.slice(0,1));
  assert.ok(csv.startsWith("\ufeff"));
  assert.equal(csv.split("\r\n").filter(Boolean).length, 2);
  assert.ok(csv.includes('"Pair O\'Brien"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""evil"")"'));
  assert.ok(csv.includes('"6-4, 6-3"'));
  assert.ok(!csv.includes("Pair B"));
});

test("CSV treats whitespace-prefixed spreadsheet formulas as text", () => {
  for (const attack of ["=2+2","  +CMD","-1+2","@SUM(1)","\t=IMPORTXML()"]) {
    assert.ok(safeCsvCell(attack).startsWith("\"'"));
  }
  assert.equal(safeCsvCell('A,"B"'), '"A,""B"""');
});

test("ICS uses full-day play-by deadline, never an invented match start time", () => {
  const calendar = makeFixtureDeadlineIcs("GSM Padel", "Autumn Cup",
    "gsm-padel", "https://rallora.test", entries, new Date("2026-09-20T10:00:00Z"));
  assert.match(calendar, /DTSTART;VALUE=DATE:20260926\r\n/);
  assert.match(calendar, /DTEND;VALUE=DATE:20260927\r\n/);
  assert.match(calendar, /Play-by deadline/);
  assert.match(calendar, /not a confirmed match booking or start time/);
  assert.match(calendar, /END:VCALENDAR\r\n$/);
  assert.equal((calendar.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assert.ok(!calendar.includes("DTSTART:20260926T"));
});

test("ICS excludes invalid calendar dates", () => {
  const bad = [{...entries[0],playBy:"2026-02-30"}];
  const calendar = makeFixtureDeadlineIcs("GSM", "S", "gsm-padel",
    "https://rallora.test", bad);
  assert.ok(!calendar.includes("BEGIN:VEVENT"));
});

test("ICS content is escaped and physical lines remain within 75 UTF-8 bytes", () => {
  const calendar = makeFixtureDeadlineIcs("GSM;Padel, Go", "Fall\\Winter",
    "gsm-padel", "https://rallora.test",
    [{...entries[0],home:"🏆".repeat(80)}]);
  assert.ok(calendar.includes("GSM\\;Padel\\, Go"));
  assert.ok(calendar.includes("Fall\\\\Winter"));
  for (const line of calendar.split("\r\n")) {
    assert.ok(Buffer.byteLength(line,"utf8") <= 75,
      "line exceeded ICS byte limit: " + line.slice(0,65));
  }
});
