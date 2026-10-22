import test from 'node:test';
import assert from 'node:assert/strict';
import {isAppleRelayEmail,playerEmails} from '../lib/player-emails.ts';

test('one ordinary address serves both purposes without using a stale hidden field',()=>{
  assert.deepEqual(playerEmails(' Player@Example.com ','old@example.com',false),{playtomic:'player@example.com',contact:'player@example.com',issue:null});
});
test('both Apple relay domains reveal and require a reachable contact address',()=>{
  for(const domain of ['privaterelay.appleid.com','private.icloud.com']){
    const relay=`hidden@${domain}`;
    assert.equal(isAppleRelayEmail(` ${relay.toUpperCase()} `),true);
    assert.ok(playerEmails(relay,'',false).issue);
    assert.deepEqual(playerEmails(relay,'Player@Hotmail.com',false),{playtomic:relay,contact:'player@hotmail.com',issue:null});
    assert.ok(playerEmails('player@example.com',relay,true).issue);
  }
});
test('optional alternative address is validated and cannot silently fall back',()=>{
  assert.ok(playerEmails('player@example.com','',true).issue);
  assert.equal(playerEmails('player@example.com','contact@example.com',true).contact,'contact@example.com');
  assert.ok(playerEmails('bad address@example.com','contact@example.com',true).issue);
  assert.equal(isAppleRelayEmail('player@icloud.com'),false);
  assert.equal(isAppleRelayEmail('player@privaterelay.appleid.com.example.com'),false);
});
