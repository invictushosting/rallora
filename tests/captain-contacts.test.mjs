import test from 'node:test';
import assert from 'node:assert/strict';
import { captainContacts } from '../lib/captain-contacts.ts';
import { captainContactsCsv } from '../lib/leagues/exports.ts';
const divisions = [{id:'d1',name:'Division 1'}];
const team = {id:'t1',division_id:'d1',name:'A / B',captain_email:'a@test.ie',player_one_name:'A',player_two_name:'B',player_one_email:'a@test.ie',player_two_email:'b@test.ie'};
const roster = [{team_id:'t1',player_user_id:'a',registration_request_id:'r1',role:'captain'}];
const application = {created_team_id:'t1',requested_by:'a',captain_name:'A',captain_phone:'+353 087 1234567',status:'approved'};
const run = (members=roster,apps=[application],regs=[]) => captainContacts('GSM','Winter',divisions,[team],members,apps,regs);

test('exports current captain and approved phone shared with club',()=>{
  assert.equal(run()[0].phone,application.captain_phone);
  assert.equal(run()[0].captain,'A');
  const csv=captainContactsCsv(run());
  assert.ok(csv.startsWith('\ufeff'));
  assert.ok(csv.includes('"\'+353 087 1234567"'));
  assert.equal(csv.split('\r\n').filter(Boolean).length,2);
});
test('does not reuse replaced captain number or pending/declined applications',()=>{
  assert.equal(run([{...roster[0],player_user_id:'replacement'}])[0].phone,'');
  for(const status of ['pending','declined','duplicate']) assert.equal(run(roster,[{...application,status}])[0].phone,'');
  assert.equal(run([])[0].phone,'');
  assert.equal(run([{...roster[0],role:'player'}])[0].phone,'');
});
test('uses approved registration tied to the current membership; rejects withdrawn and mismatched snapshots',()=>{
  const r={id:'r1',team_id:'t1',player_user_id:'a',player_name:'Updated Captain',player_phone:'0870012345',status:'approved'};
  assert.equal(run(roster,[application],[r])[0].phone,'0870012345');
  for(const changed of [{status:'withdrawn'},{team_id:'other'},{player_user_id:'other'},{id:'old'}]) {
    assert.equal(run(roster,[],[{...r,...changed}])[0].phone,'');
  }
});
test('ignores teams outside selected divisions and protects CSV formulas, quotes and accents',()=>{
  assert.deepEqual(captainContacts('GSM','Winter',[],[team],roster,[application],[]),[]);
  const csv=captainContactsCsv([{...run()[0],captain:'Faolán, "Captain"',team:'=1+1',phone:'0870012345'}]);
  assert.ok(csv.includes('Faolán, ""Captain""'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"0870012345"'));
});
