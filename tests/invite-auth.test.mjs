import test from 'node:test';
import assert from 'node:assert/strict';
import {inviteAuthError} from '../lib/invite-auth.ts';

test('failed sign-in guides new and existing players without claiming account existence',()=>{
 const message=inviteAuthError({code:'invalid_credentials'},'signin');
 assert.match(message,/Create account/);assert.match(message,/Forgot password/);
 assert.equal(message,inviteAuthError({message:'Invalid login credentials'},'signin'));
});
test('unconfirmed accounts explain how to resume the same invitation',()=>{
 assert.match(inviteAuthError({code:'email_not_confirmed'},'signin'),/resend.*return to this invitation/);
});
test('duplicate signup offers sign-in and recovery instead of another registration',()=>{
 assert.match(inviteAuthError({code:'user_already_exists'},'create'),/Sign in.*Forgot password.*invitation is still available/);
});
test('rate limits and network failures provide a retry path',()=>{
 assert.match(inviteAuthError({code:'over_email_send_rate_limit'},'create'),/wait/);
 assert.match(inviteAuthError({},'create'),/create your account/);
 assert.match(inviteAuthError({},'signin'),/sign you in/);
});
