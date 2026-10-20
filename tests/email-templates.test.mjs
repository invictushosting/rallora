import test from 'node:test';
import assert from 'node:assert/strict';
import {renderClubEmail,renderRalloraEmail,emailBrandColours} from '../lib/email-templates.ts';

const content={preview:'Your place is confirmed',eyebrow:'REGISTRATION APPROVED',title:'You’re in.\nSee you on court.',contentHtml:'<p>Hi Steven, your pairing is approved.</p>',action:{label:'View my league',url:'https://www.rallora.app/clubs/example'}};
test('club email leads with its saved logo and colour and includes the Rallora footer',()=>{
 const html=renderClubEmail({name:'Example Padel',logoUrl:'https://club.example/logo.png',primaryColour:'#123f37'},content);
 assert.match(html,/src="https:\/\/club.example\/logo.png"/);
 assert.match(html,/bgcolor="#123f37"/);
 assert.ok(html.indexOf('Example Padel logo')<html.indexOf('POWERED BY'));
 assert.match(html,/rallora-email-logo-final.png/);assert.match(html,/The Example Padel team/);
 assert.match(html,/href="https:\/\/www.rallora.app\/clubs\/example"/);
 assert.match(html,/Reply to this email to contact your club/);
});
test('Rallora emails use its own brand header, signoff and support identity',()=>{
 const html=renderRalloraEmail({...content,title:'Welcome to Rallora'});
 assert.match(html,/alt="Rallora — Play Connect Progress"/);
 assert.match(html,/border-bottom:5px solid #00b0fe/);
 assert.match(html,/The Rallora team/);assert.doesNotMatch(html,/POWERED BY/);
 assert.match(html,/Rallora team will help/);
});
test('missing or unsafe club logos fall back to an escaped club name',()=>{
 for(const logoUrl of [null,'javascript:alert(1)','data:image/svg+xml,bad','http://unsafe.example/a.png','https://user:pass@club.example/logo']){
  const html=renderClubEmail({name:'<Club & Friends>',logoUrl,primaryColour:'red; background:url(evil)'},content);
  assert.match(html,/&lt;Club &amp; Friends&gt;/);assert.doesNotMatch(html,/<Club|src="javascript:|src="data:|unsafe.example|user:pass|background:url/);
  assert.match(html,/bgcolor="#061a39"/);
 }
});
test('untrusted metadata and attributes cannot create markup or unsafe action links',()=>{
 const html=renderClubEmail({name:'Club',logoUrl:'https://club.example/logo.png?a=1&b=2'}, {...content,preview:'<script>bad</script>',eyebrow:'<b>Bad</b>',title:'<img src=x>\nUpdate',action:{label:'<b>Open</b>',url:'javascript:alert(1)'}});
 assert.match(html,/&lt;script&gt;bad&lt;\/script&gt;/);assert.match(html,/&lt;img src=x&gt;<br>Update/);
 assert.match(html,/a=1&amp;b=2/);assert.doesNotMatch(html,/<script>|href="javascript:|<img src=x>/);
 const safe=renderRalloraEmail({...content,action:{label:'<Open>',url:content.action.url}});
 assert.match(safe,/&lt;Open&gt;<\/a>/);
});
test('light and dark club colours choose readable text and preserve valid colours',()=>{
 assert.deepEqual(emailBrandColours('#ffffff'),{background:'#ffffff',foreground:'#061a39'});
 assert.deepEqual(emailBrandColours('#061a39'),{background:'#061a39',foreground:'#ffffff'});
 assert.equal(emailBrandColours('#00b0fe').foreground,'#061a39');
 for(const colour of [undefined,'#fff','invalid'])assert.equal(emailBrandColours(colour).background,'#061a39');
});
test('layouts retain email-client tables, a hidden preview and mobile spacing',()=>{
 for(const html of [renderRalloraEmail(content),renderClubEmail({name:'Club'},content)]){
  assert.match(html,/role="presentation"/);assert.match(html,/mso-hide:all/);
  assert.match(html,/@media\(max-width:440px\)/);assert.match(html,/max-width:540px/);
  assert.doesNotMatch(html,/<script|display:grid|display:flex|\.svg["?]/);
 }
});
