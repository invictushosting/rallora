import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultCommunicationSettings,communicationActionUrl} from '../lib/communication.ts';
test('club defaults are paused, independent, and include all promised reminder controls',()=>{
 const a=defaultCommunicationSettings('a'),b=defaultCommunicationSettings('b');
 assert.equal(a.enabled,false);assert.equal(a.timezone,'Europe/London');assert.equal(a.rules.booking.hours,168);assert.equal(a.rules.confirmation.hours,24);assert.equal(a.rules.overdue.repeat_hours,72);
 a.rules.booking.enabled=false;assert.equal(b.rules.booking.enabled,true);assert.equal(a.daily_limit,3);
 assert.deepEqual(Object.keys(a.rules),['booking','upcoming','missing_result','confirmation','overdue','registration','fixtures','results']);
});
test('delivery action links cannot be redirected to external origins or arbitrary routes',()=>{
 assert.equal(communicationActionUrl('/clubs/gsm-padel/captain'),'https://www.rallora.app/clubs/gsm-padel/captain');
 assert.equal(communicationActionUrl('/clubs/gsm-padel/join-team?invite=123'),'https://www.rallora.app/clubs/gsm-padel/join-team?invite=123');
 for(const path of ['https://evil.example','//evil.example/captain','/clubs/../admin','/clubs/gsm-padel/captain/../../account','/login','/clubs/gsm-padel/captain#bad'])assert.throws(()=>communicationActionUrl(path));
});
