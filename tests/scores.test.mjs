import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreSets,resultScores} from '../lib/leagues/scores.ts';

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

test('set entry preserves fixed home and away rows, zeros and unplayed sets',()=>{
  assert.deepEqual(resultScores([{home:'5',away:'7'},{home:'4',away:'6'},{home:'6',away:'4'}]),{home:'5,4,6',away:'7,6,4'});
  assert.deepEqual(resultScores([{home:'0',away:'6'},{home:'',away:''},{home:'',away:''}]),{home:'0',away:'6'});
  assert.deepEqual(resultScores([{home:'10',away:'8'}]),{home:'10',away:'8'});
});

test('set entry rejects missing opponents, skipped sets and invalid games',()=>{
  assert.throws(()=>resultScores([{home:'',away:''}]),/at least one set/);
  assert.throws(()=>resultScores([{home:'6',away:''}]),/both teams/);
  assert.throws(()=>resultScores([{home:'6',away:'4'},{home:'',away:''},{home:'6',away:'3'}]),/sets in order/);
  for(const home of ['-1','1.5','6-4','100','Walkover'])assert.throws(()=>resultScores([{home,away:'4'}]),/whole numbers/);
});
