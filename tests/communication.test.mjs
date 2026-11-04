import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultCommunicationSettings,communicationActionUrl,deliveryPresentation} from '../lib/communication.ts';
test('club defaults are paused, independent, and include all promised reminder controls',()=>{
 const a=defaultCommunicationSettings('a'),b=defaultCommunicationSettings('b');
 assert.equal(a.enabled,false);assert.equal(a.timezone,'Europe/London');assert.equal(a.rules.booking.hours,168);assert.equal(a.rules.confirmation.hours,24);assert.equal(a.rules.overdue.repeat_hours,72);
 a.rules.booking.enabled=false;assert.equal(b.rules.booking.enabled,true);assert.equal(a.daily_limit,3);
 assert.deepEqual(Object.keys(a.rules),['booking','upcoming','missing_result','confirmation','overdue','registration','fixtures','messages','results']);
});
test('delivery action links cannot be redirected to external origins or arbitrary routes',()=>{
 assert.equal(communicationActionUrl('/clubs/gsm-padel/captain'),'https://www.rallora.app/clubs/gsm-padel/captain');
 assert.equal(communicationActionUrl('/clubs/gsm-padel/join-team?invite=123'),'https://www.rallora.app/clubs/gsm-padel/join-team?invite=123');
 for(const path of ['https://evil.example','//evil.example/captain','/clubs/../admin','/clubs/gsm-padel/captain/../../account','/login','/clubs/gsm-padel/captain#bad'])assert.throws(()=>communicationActionUrl(path));
});

test('match alert links point to a validated fixture route',()=>{
 const id='11111111-1111-1111-1111-111111111111';
 assert.equal(communicationActionUrl('/clubs/gsm-padel/matches/'+id),'https://www.rallora.app/clubs/gsm-padel/matches/'+id);
 for(const suffix of ['../../admin','not-an-id',id+'?redirect=evil',id+'#bad',id+'/edit']) assert.throws(()=>communicationActionUrl('/clubs/gsm-padel/matches/'+suffix));
});

test('partner email opens the same invitation and explains independent account access',()=>{
 const invite='/clubs/gsm-padel/join-team?invite=11111111-1111-1111-1111-111111111111';
 const result=deliveryPresentation({actionUrl:invite,body:'Your pairing is ready.'});
 assert.equal(result.url,'https://www.rallora.app'+invite);
 assert.equal(result.label,'Create your account or sign in');
 assert.match(result.body,/email address that received this invitation/);
 assert.match(result.body,/then claim your team place/);
 assert.match(result.body,/captains manage results/);
 for(const actionUrl of ['/clubs/gsm-padel/captain','/clubs/gsm-padel/captain?next=/join-team']) {
  const other=deliveryPresentation({actionUrl,body:'Existing reminder'});
  assert.equal(other.label,'Open your club');
  assert.equal(other.body,'Existing reminder');
 }
 assert.throws(()=>deliveryPresentation({actionUrl:'https://evil.example/join-team',body:'Invalid'}));
});
