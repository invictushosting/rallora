import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreSets} from '../lib/leagues/scores.ts';

test('mirrored notation preserves each pairing’s own games and winning sets',()=>{
  const home=scoreSets('6-4, 6-3'),away=scoreSets('4-6, 3-6');
  assert.deepEqual(home,['6','6']);assert.deepEqual(away,['4','3']);
  assert.equal(home.reduce((total,n)=>total+Number(n),0)-away.reduce((total,n)=>total+Number(n),0),5);
  assert.ok(home.every((n,index)=>Number(n)>Number(away[index])));
});
test('numeric score lists keep the same values across spaces and commas',()=>{
  for(const score of ['7, 6','7 6',' 7,  6 '])assert.deepEqual(scoreSets(score),['7','6']);
  assert.deepEqual(scoreSets('10'),['10']);
});
test('paired notation accepts separators used when copying score text',()=>{
  for(const score of ['7:6, 6:4','7–6, 6–4','7—6, 6—4'])assert.deepEqual(scoreSets(score),['7','6']);
});
test('missing scores stay empty and non-score labels remain readable',()=>{
  for(const score of [null,undefined,'',' '])assert.deepEqual(scoreSets(score),[]);
  assert.deepEqual(scoreSets('Walkover'),['Walkover']);
});
