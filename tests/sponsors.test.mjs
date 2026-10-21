import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingSponsors, sponsorshipEmail, sponsorPositions } from '../lib/sponsors.ts';
const sponsor = (id, extra={}) => ({id,club_id:'club-a',name:id,sponsor_type:null,logo_url:null,website_url:null,scope_type:'club',scope_id:null,is_main:false,is_active:true,sort_order:0,placement:'above-tables',...extra});
test('sponsor targeting isolates clubs, selected leagues, divisions and events', () => {
  const rows=[sponsor('main',{is_main:true}),sponsor('league-a',{scope_type:'league',scope_id:'season-a'}),sponsor('league-b',{scope_type:'league',scope_id:'season-b'}),sponsor('division',{scope_type:'division',scope_id:'division-a'}),sponsor('event',{scope_type:'event',scope_id:'event-a'}),sponsor('other-club',{club_id:'club-b'}),sponsor('hidden',{is_active:false})];
  assert.deepEqual(matchingSponsors(rows,{clubId:'club-a',seasonId:'season-a'},'above-tables').map(x=>x.id),['league-a','main']);
  assert.deepEqual(matchingSponsors(rows,{clubId:'club-a',seasonId:'season-a',divisionId:'division-a'},'above-tables').map(x=>x.id),['division','league-a','main']);
  assert.deepEqual(matchingSponsors(rows,{clubId:'club-a',eventId:'event-a'},'above-tables').map(x=>x.id),['event','main']);
  assert.deepEqual(matchingSponsors(rows,{clubId:'club-a'},'above-tables').map(x=>x.id),['main']);
});
test('multiple placements and legacy partner-area placement are retained',()=>{
  assert.deepEqual(sponsorPositions('after-header, above-footer'),['after-header','above-footer']);
  assert.deepEqual(sponsorPositions('homepage,cup'),['above-footer']);
  assert.deepEqual(matchingSponsors([sponsor('one',{placement:'after-header,above-footer'})],{clubId:'club-a'},'above-tables'),[]);
});
test('contact link uses a validated club email and safely encoded competition subject',()=>{
  assert.equal(sponsorshipEmail(null,'Winter league'),null);
  assert.equal(sponsorshipEmail('hello@example.com?bcc=someone@example.com','League'),null);
  assert.equal(sponsorshipEmail('hello@example.com\r\nBcc: other@example.com','League'),null);
  assert.equal(sponsorshipEmail(' club@example.com ','Winter & Summer'), 'mailto:club@example.com?subject=Sponsorship%20enquiry%3A%20Winter%20%26%20Summer');
});
