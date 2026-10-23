import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyRounds, validateRoundWindows, savedRoundWindows, nextPlannedRound } from '../lib/competition-schedule.ts';
test('GSM monthly season gives three complete inclusive playing windows', () => {
 const rounds = monthlyRounds('2026-11-02', '2027-02-01');
 assert.deepEqual(rounds, [
  {starts_on:'2026-11-02',ends_on:'2026-12-01'},
  {starts_on:'2026-12-02',ends_on:'2027-01-01'},
  {starts_on:'2027-01-02',ends_on:'2027-02-01'},
 ]);
 assert.equal(validateRoundWindows(rounds,'2026-11-02','2027-02-01'),'');
 assert.deepEqual(nextPlannedRound(rounds,'2026-12-01'),rounds[1]);
 assert.equal(nextPlannedRound(rounds,'2027-02-01'),undefined);
});
test('monthly boundaries handle short months and retain original day without drift', () => {
 assert.deepEqual(monthlyRounds('2028-01-31','2028-03-30'),[
  {starts_on:'2028-01-31',ends_on:'2028-02-28'},
  {starts_on:'2028-02-29',ends_on:'2028-03-30'},
 ]);
 assert.equal(monthlyRounds('2026-11-02','2026-11-20')[0].ends_on,'2026-11-20');
 assert.deepEqual(monthlyRounds('2026-02-30','2027-01-01'),[]);
 assert.deepEqual(monthlyRounds('2026-11-02','2025-01-01'),[]);
 assert.deepEqual(monthlyRounds('2026-01-01','2040-01-01'),[]);
});
test('custom windows allow a holiday break but reject overlaps and missing coverage', () => {
 const plan = [{starts_on:'2026-11-02',ends_on:'2026-12-15'},{starts_on:'2027-01-02',ends_on:'2027-02-01'}];
 assert.equal(validateRoundWindows(plan,'2026-11-02','2027-02-01'),'');
 assert.match(validateRoundWindows([{...plan[0],ends_on:'2027-01-02'},plan[1]],'2026-11-02','2027-02-01'),/after the previous/);
 assert.match(validateRoundWindows(plan,'2026-11-02','2027-03-01'),/final round/);
 assert.deepEqual(savedRoundWindows(null),[]);
 assert.deepEqual(savedRoundWindows([{starts_on:'invalid',ends_on:'2026-12-01'}]),[]);
 assert.deepEqual(savedRoundWindows(plan),plan);
});
