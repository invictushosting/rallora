import test from 'node:test';
import assert from 'node:assert/strict';
import {canRespondToProposal, proposalIsCurrent, localDateTime} from '../lib/fixture-messaging.ts';
const context={writable:true,viewer_team_id:'away',home_roster_version:2,away_roster_version:3};
const proposal={kind:'proposal',sender_team_id:'home',sender_user_id:'home-captain',proposal_status:'pending',starts_at:'2099-01-01T10:00:00Z',home_roster_version:2,away_roster_version:3};
test('only the opposing captain can respond to a current pending time proposal',()=>{
 assert.ok(canRespondToProposal(proposal,context,'away-captain'));
 for(const changed of [{viewer_team_id:'home'},{viewer_team_id:null},{writable:false},{home_roster_version:4},{away_roster_version:4}]) assert.equal(canRespondToProposal(proposal,{...context,...changed},'away-captain'),false);
 assert.equal(canRespondToProposal(proposal,context,'home-captain'),false);
 for(const status of ['accepted','declined','superseded']) assert.equal(canRespondToProposal({...proposal,proposal_status:status},context,'away-captain'),false);
});
test('expired times and changed pairings require a new proposal',()=>{
 assert.equal(proposalIsCurrent({...proposal,starts_at:'2020-01-01T10:00:00Z'},context),false);
 assert.equal(proposalIsCurrent({...proposal,starts_at:'bad date'},context),false);
 assert.equal(proposalIsCurrent({...proposal,kind:'message'},context),false);
 assert.equal(proposalIsCurrent({...proposal,starts_at:null},context),false);
});
test('agreed booking input uses local device time without changing the instant',()=>{
 const stamp='2026-10-28T14:30:00Z';
 const result=localDateTime(stamp);
 assert.match(result,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
 assert.equal(new Date(result).getTime(),new Date(stamp).getTime());
});
