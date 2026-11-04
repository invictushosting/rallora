import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureMatchesQuery } from '../lib/leagues/fixture-discovery.ts';

const match = ['Division 1B', 'Emma Hall / A. Partner', 'The Lobbers', 'Round 2', 'Week 2', 'Court 3'];

test('search matches a division as well as player or team names', () => {
  assert.equal(fixtureMatchesQuery('division 1b', match), true);
  assert.equal(fixtureMatchesQuery('1B Emma', match), true);
  assert.equal(fixtureMatchesQuery('lobbers', match), true);
  assert.equal(fixtureMatchesQuery('round 2', match), true);
  assert.equal(fixtureMatchesQuery('court 3', match), true);
});

test('search is case-insensitive, supports multiple words and blank queries', () => {
  assert.equal(fixtureMatchesQuery('  EMMA   1b ', match), true);
  assert.equal(fixtureMatchesQuery('', match), true);
  assert.equal(fixtureMatchesQuery('   ', match), true);
  assert.equal(fixtureMatchesQuery('Division 3C', match), false);
  assert.equal(fixtureMatchesQuery('Emma Sophie', match), false);
});

test('search safely handles empty metadata and numeric rounds', () => {
  assert.equal(fixtureMatchesQuery('round 3', [undefined, null, 'Round 3', 3]), true);
  assert.equal(fixtureMatchesQuery('someone', [undefined, null]), false);
});

test('retired fixtures are hidden while cancelled court bookings can be rearranged', async () => {
 const {fixtureIsPublished}=await import('../lib/leagues/fixture-discovery.ts');
 const fixtures=[{id:'retired',status:'cancelled',arrangement_status:'cancelled'},{id:'rebook',status:'open',arrangement_status:'cancelled'},{id:'upcoming',status:'open'},{id:'history',status:'confirmed'}];
 assert.deepEqual(fixtures.filter(fixtureIsPublished).map(f=>f.id),['rebook','upcoming','history']);
});
