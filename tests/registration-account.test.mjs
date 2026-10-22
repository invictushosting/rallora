import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationAccountIssue} from '../lib/registration-account.ts';

test('legacy restored drafts with no credentials must return to the account step', () => {
  assert.match(registrationAccountIssue('', '', 'create'), /email and password/);
  assert.match(registrationAccountIssue('   ', 'some-password', 'create'), /email and password/);
});
test('restored email never substitutes for the unsaved password', () => {
  assert.match(registrationAccountIssue('player@example.com', '', 'create'), /password of at least 8/);
  assert.match(registrationAccountIssue('player@example.com', '', 'signin'), /enter your password/);
});
test('new accounts require valid email and minimum password length', () => {
  for (const email of ['player', 'player@', 'player @example.com']) {
    assert.ok(registrationAccountIssue(email, 'password123', 'create'));
  }
  assert.ok(registrationAccountIssue('player@example.com', 'short', 'create'));
  assert.equal(registrationAccountIssue(' player@example.com ', 'password123', 'create'), null);
});
test('existing account credentials are not held to new password rules', () => {
  assert.equal(registrationAccountIssue('player@example.com', 'legacy', 'signin'), null);
});
