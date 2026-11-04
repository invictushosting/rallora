import test from 'node:test';
import assert from 'node:assert/strict';
import {fixturePlayerLabel} from '../lib/fixture-rosters.ts';
test('recorded matches and exports retain names after a player moves',()=>{
 const f={home_team_id:'a',away_team_id:'b',home_player_names:['Original captain','Original partner'],away_player_names:['Opponent',null]};
 assert.equal(fixturePlayerLabel(f,'a','New captain / New partner'),'Original captain / Original partner');
 assert.equal(fixturePlayerLabel(f,'b','Changed opponent'),'Opponent');
 assert.equal(fixturePlayerLabel(f,'unrelated','Other'),'Other');
});
test('upcoming and legacy unsnapshotted fixtures use current rosters',()=>{
 assert.equal(fixturePlayerLabel({home_team_id:'a',away_team_id:'b'},'a','New captain / New partner'),'New captain / New partner');
});
