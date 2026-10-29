import test from 'node:test';
import assert from 'node:assert/strict';
import {accountRecoveryNotice} from '../lib/account-recovery.ts';
test('expired links in fragments and queries explain how to recover',()=>{
 for(const [search,hash] of [['','#error=access_denied&error_code=otp_expired'],['?error_code=otp_expired',''],['','#error_description=Email+link+is+invalid+or+has+expired']]){
  assert.match(accountRecoveryNotice(search,hash),/expired or already been used.*newest link/);
 }
});
test('provider errors never echo arbitrary error descriptions or credentials',()=>{
 const notice=accountRecoveryNotice('?error=access_denied&error_description=private-secret','');
 assert.match(notice,/could not sign you in/);assert.doesNotMatch(notice,/private-secret/);
});
test('valid callback and ordinary account pages do not display an error',()=>{
 assert.equal(accountRecoveryNotice('?code=valid-code',''),'');assert.equal(accountRecoveryNotice('','#access_token=valid-token'),'');assert.equal(accountRecoveryNotice('',''),'');
});
