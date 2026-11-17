import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyRounds, validateRoundWindows, savedRoundWindows, nextPlannedRound, validateRoundDateChange } from '../lib/competition-schedule.ts';
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
test('extend GSM round 1 across December and leave a Christmas break without overlaps', () => {
 const plan = monthlyRounds('2026-11-01','2027-03-31');
 const future = [{starts_on:'2026-12-27',ends_on:'2026-12-31'}, ...plan.slice(2)];
 assert.equal(validateRoundDateChange('2026-11-01','2026-11-30','2026-12-20',plan,future,'2027-03-31'),'');
 assert.match(validateRoundDateChange('2026-11-01','2026-11-30','2026-12-20',plan,plan.slice(1),'2027-03-31'),/after the previous/);
 assert.match(validateRoundDateChange('2026-11-01','2026-11-30','2026-02-30',plan,future,'2027-03-31'),/Choose a deadline/);
 assert.match(validateRoundDateChange('2026-11-01','2026-11-30','2026-12-20',plan,[...future.slice(0,-1),{starts_on:'2027-03-01',ends_on:'2027-04-01'}],'2027-03-31'),/final round/);
 assert.match(validateRoundDateChange('2026-11-01','2026-11-30','2026-12-20',plan,future.slice(1),'2027-03-31'),/does not match/);
});
test('editing later rounds retains earlier history and handles legacy schedules', () => {
 const plan=monthlyRounds('2026-11-01','2027-03-31');
 assert.equal(validateRoundDateChange('2026-12-01','2026-12-31','2027-01-05',plan,[{starts_on:'2027-01-06',ends_on:'2027-01-31'},...plan.slice(3)],'2027-03-31'),'');
 assert.equal(validateRoundDateChange('2026-11-01','2026-11-30','2026-12-20',[],[],'2027-03-31'),'');
 assert.match(validateRoundDateChange('2026-11-01','2026-11-30','2027-04-01',[],[],'2027-03-31'),/competition finish/);
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

