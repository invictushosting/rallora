import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationStatus} from '../lib/registration-status.ts';

test('a submitted entry is clearly distinct from club approval',()=>{
 const pending=registrationStatus('pending');
 assert.match(pending.title,/Application received.*awaiting club approval/);
 assert.match(pending.description,/submitted successfully/);
 assert.match(pending.description,/not yet approved/);
 assert.match(pending.description,/do not need to submit again/);
 assert.match(registrationStatus('approved').description,/when they are published/);
});
test('partner finding and standby receipts do not promise league entry',()=>{
 assert.match(registrationStatus('single').description,/not guaranteed/);
 assert.match(registrationStatus('standby').description,/if a replacement is needed/);
});
test('declined and unfamiliar records cannot be labelled successfully approved',()=>{
 assert.equal(registrationStatus('rejected').title,'Registration not approved');
 assert.equal(registrationStatus('declined').title,'Registration not approved');
 assert.equal(registrationStatus('withdrawn').title,'Registration on record');
});

test("duplicate closure is distinct from rejection and never promises approval",()=>{
 const receipt=registrationStatus("duplicate");
 assert.equal(receipt.title,"Duplicate registration closed");
 assert.match(receipt.description,/does not reject/);
 assert.match(receipt.description,/or confirm approval/);
});
