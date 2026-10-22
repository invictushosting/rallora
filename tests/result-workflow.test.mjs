import test from 'node:test';
import assert from 'node:assert/strict';
import {captainResultState} from '../lib/leagues/result-workflow.ts';
const fixture={id:'match',status:'submitted'};
const old={id:'old',fixture_id:'match',submitting_team_id:'home',submitted_by_user_id:'captain-a',home_score:'6-4',away_score:'4-6',notes:null,dispute_note:null,status:'disputed',updated_at:'2026-10-18T10:00:00Z'};
const pending={...old,id:'new',submitting_team_id:'away',submitted_by_user_id:'captain-b',status:'pending_opponent',updated_at:'2026-10-19T10:00:00Z'};
const state=(submissions=[],results=[],status='active',viewer='captain-a')=>captainResultState(fixture,'home',viewer,status,submissions,results);
test('the official corrected score wins over stale captain submissions',()=>{
 const result={fixture_id:'match',home_score:'6-2',away_score:'2-6',status:'admin_override'};
 const view=state([old,pending],[result]);assert.equal(view.official.home_score,'6-2');assert.equal(view.confirmed,true);assert.equal(view.action,false);assert.equal(view.label,'CONFIRMED');
});
test('the newest review is selected regardless of database row order',()=>{
 for(const rows of [[pending,old],[old,pending]]){const view=state(rows);assert.equal(view.submission.id,'new');assert.equal(view.needsReview,true);}
});
test('a captain cannot review a submission they authored for another pairing',()=>{
 assert.equal(state([pending],[],'active','captain-b').needsReview,false);
});
test('super admin can review from the opposing pairing while retaining their identity',()=>{
 assert.equal(captainResultState(fixture,'home','captain-b','active',[pending],[],true).needsReview,true);
 assert.equal(captainResultState(fixture,'away','captain-b','active',[pending],[],true).needsReview,false);
 for(const status of ['draft','completed'])assert.equal(captainResultState(fixture,'home','captain-b',status,[pending],[],true).action,false);
});
test('draft and cancelled fixtures remain identifiable without captain actions',()=>{
 const draft=captainResultState({...fixture,status:'open'},'home','admin','draft',[],[],true);
 assert.equal(draft.label,'DRAFT');assert.equal(draft.action,false);
 const cancelled=captainResultState({...fixture,status:'cancelled'},'home','admin','active',[pending],[],true);
 assert.equal(cancelled.label,'CANCELLED');assert.equal(cancelled.action,false);
});
test('completed and draft cycles do not ask captains to submit or review',()=>{
 for(const status of ['completed','draft']){assert.equal(state([pending],[],status).action,false);assert.equal(captainResultState({...fixture,status:'open'},'home','captain-a',status,[],[]).needsSubmit,false);}
});
test('disputes stay with organisers and unconfirmed scores are not labelled final',()=>{
 const view=state([old]);assert.equal(view.label,'WITH ORGANISER');assert.equal(view.confirmed,false);assert.equal(view.action,false);
 const waiting=state([{...pending,submitting_team_id:'home'}]);assert.equal(waiting.label,'AWAITING CONFIRMATION');assert.equal(waiting.confirmed,false);
});
test('only a new open fixture without submissions needs a score',()=>{
 assert.equal(captainResultState({...fixture,status:'open'},'home','captain-a','active',[],[]).needsSubmit,true);
 assert.equal(captainResultState({...fixture,status:'cancelled'},'home','captain-a','active',[],[]).action,false);
 assert.equal(captainResultState({...fixture,status:'confirmed'},'home','captain-a','active',[],[]).confirmed,true);
});
