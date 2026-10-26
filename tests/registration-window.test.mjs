import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationWindowState,selectRegistrationSeason} from '../lib/registration-window.ts';
const winter={id:'winter',registration_published:true,registration_opens_at:'2026-10-21T07:30:30Z',registration_closes_at:'2026-10-25T23:59:59Z'};
const ladies={...winter,id:'ladies',registration_closes_at:'2026-10-28T23:59:00Z'};
const monday=Date.parse('2026-10-26T09:00:00Z');
test('GSM winter is closed on Monday while ladies remains open',()=>{
 assert.equal(registrationWindowState(winter,monday),'closed');
 assert.equal(registrationWindowState(ladies,monday),'open');
});
test('opening and closing boundaries match inclusive database checks',()=>{
 const open=Date.parse(winter.registration_opens_at),close=Date.parse(winter.registration_closes_at);
 assert.equal(registrationWindowState(winter,open-1),'upcoming');
 assert.equal(registrationWindowState(winter,open),'open');
 assert.equal(registrationWindowState(winter,close),'open');
 assert.equal(registrationWindowState(winter,close+1),'closed');
});
test('timestamps with offsets describe the same deadline across DST',()=>{
 assert.equal(registrationWindowState({...winter,registration_closes_at:'2026-10-26T00:59:59+01:00'},monday),'closed');
});
test('unpublished, missing or invalid settings cannot advertise open registration',()=>{
 assert.equal(registrationWindowState({...winter,registration_published:false},monday),'hidden');
 assert.equal(registrationWindowState(null,monday),'hidden');
 assert.equal(registrationWindowState({...winter,registration_closes_at:'invalid'},monday),'closed');
 assert.equal(registrationWindowState({...winter,registration_opens_at:null,registration_closes_at:null},monday),'open');
});
test('a closed or unknown direct league link never silently switches to an open league',()=>{
 assert.equal(selectRegistrationSeason([ladies,winter],'winter',monday)?.id,'winter');
 assert.equal(selectRegistrationSeason([ladies,winter],'unknown',monday),null);
 assert.equal(selectRegistrationSeason([ladies,winter],'',monday)?.id,'ladies');
 assert.equal(selectRegistrationSeason([winter],'',monday),null);
});
