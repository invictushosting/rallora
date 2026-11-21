import test from 'node:test';
import assert from 'node:assert/strict';
import {createArtwork, preparePost, roundMatches, resultFingerprint, ARTWORK_SIZES} from '../lib/social/studio.ts';
const match={id:'a',seasonId:'league-a',season:'Winter',week:1,division:'Division 1A',home:'Emma Hall / Marc Jones',away:'Sam Norfolk / Steve Shaw',homeScore:'6  4  6',awayScore:'4  6  3',score:'6 / 4 / 6 : 4 / 6 / 3',confirmedAt:'2026-11-20'};
const input={club:'Example Padel',accent:'#00b0fe',title:'Round one results',body:'Hello club',size:'square',style:'court',matches:[match]};
test('roundups cannot mix leagues with identical names or other rounds',()=>{
  const other={...match,id:'b',seasonId:'league-b'};
  const later={...match,id:'c',week:2};
  assert.deepEqual(roundMatches([match,other,later],match),[match]);
  const post=preparePost('roundup',[match,other,later],match);
  assert.equal(post.body.split('Division 1A:').length,2);
});
test('source fingerprint detects corrected scores, replaced players and revoked sources',()=>{
  assert.notEqual(resultFingerprint([match]),resultFingerprint([{...match,homeScore:'0'}]));
  assert.notEqual(resultFingerprint([match]),resultFingerprint([{...match,home:'Replacement player'}]));
  assert.notEqual(resultFingerprint([match]),resultFingerprint([]));
  const second={...match,id:'b'};
  assert.equal(resultFingerprint([match,second]),resultFingerprint([second,match]));
});
test('all formats and styles carry fixed source score rows and exact export dimensions',()=>{
  for (const [size,{height}] of Object.entries(ARTWORK_SIZES)) for(const style of ['court','editorial','minimal']) {
    const {svg}=createArtwork({...input,size,style});
    assert.match(svg,new RegExp(`viewBox="0 0 1080 ${height}"`));
    assert.ok(svg.includes(match.home));assert.ok(svg.includes(match.away));
    const homeRow=svg.slice(svg.indexOf('>HOME</text>'),svg.indexOf('>AWAY</text>'));
    const awayRow=svg.slice(svg.indexOf('>AWAY</text>'));
    for (const score of match.homeScore.split(/\s+/)) assert.ok(homeRow.includes(`>${score}</text>`));
    for (const score of match.awayScore.split(/\s+/)) assert.ok(awayRow.includes(`>${score}</text>`));
    assert.ok(!svg.includes('<script'));
  }
});
test('artwork escapes injection and rejects unsafe colour/logo inputs',()=>{
  const {svg}=createArtwork({...input,club:'<script>alert(1)</script>',title:'<img onload="x">',body:'a & b',accent:'red" onload="x',logoData:'javascript:alert(1)',matches:[]});
  assert.ok(!svg.includes('<script')); assert.ok(!svg.includes('<img'));
  assert.ok(!svg.includes('javascript:')); assert.ok(svg.includes('&amp;')); assert.ok(svg.includes('#00B0FE'));
});
test('roundup artwork discloses overflow and captions preserve the full selected round',()=>{
  const matches=Array.from({length:20},(_,i)=>({...match,id:String(i)}));
  const art=createArtwork({...input,matches});
  assert.ok(art.omitted>0);assert.match(art.svg,/more results in the club hub/);
  assert.ok(preparePost('roundup',matches,match).body.length<=3500);
});
test('long unbroken and Unicode content remains bounded',()=>{
  const {svg,omitted}=createArtwork({...input,title:'🎾'.repeat(140),body:'a'.repeat(3500),matches:[]});
  assert.ok(omitted>0);assert.ok(svg.length<12000);assert.ok(!svg.includes('undefined'));
});
