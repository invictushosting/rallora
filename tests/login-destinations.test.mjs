import test from 'node:test';
import assert from 'node:assert/strict';
import {loginDestinations} from '../lib/login-destinations.ts';
const club={slug:'club-a',name:'Club A',is_active:true};
test('player and captain accounts go to their own club areas',()=>{
 assert.deepEqual(loginDestinations(false,[],[{role:'player',clubs:club}]),[{href:'/clubs/club-a',club:'Club A',label:'Fixtures & league tables'}]);
 const links=loginDestinations(false,[],[{role:'player',clubs:club},{role:'captain',clubs:club},{role:'captain',clubs:club}]);
 assert.deepEqual(links,[{href:'/clubs/club-a/captain',club:'Club A',label:'Captain centre'}]);
});
test('club organisers and platform admins retain separate destinations',()=>{
 const links=loginDestinations(true,[{role:'owner',clubs:club},{role:'admin',clubs:club}],[{role:'captain',clubs:{...club,slug:'club-b',name:'Club B'}}]);
 assert.deepEqual(links.map(x=>x.href),['/platform','/clubs/club-a/admin','/clubs/club-b/captain']);
 assert.equal(loginDestinations(false,[{role:'player',clubs:club}],[]).length,0);
});
test('unlinked and inactive memberships never produce an accessible club choice',()=>{
 assert.deepEqual(loginDestinations(false,[{role:'owner',clubs:null}],[{role:'captain',clubs:{...club,is_active:false}}]),[]);
 assert.deepEqual(loginDestinations(false,[],[]),[]);
});
test('club path segments are encoded and multiple roles in one club remain available',()=>{
 const c={...club,slug:'club / special'};
 const links=loginDestinations(false,[{role:'organiser',clubs:c}],[{role:'captain',clubs:c}]);
 assert.deepEqual(links.map(x=>x.href),['/clubs/club%20%2F%20special/admin','/clubs/club%20%2F%20special/captain']);
});
