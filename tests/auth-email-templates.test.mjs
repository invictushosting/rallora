import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AUTH_EMAIL_DEFINITIONS,renderAuthEmail,renderClubEmail,authEmailTemplateConfig} from '../lib/email-templates.ts';
const types=Object.keys(AUTH_EMAIL_DEFINITIONS);
test('all account emails share the approved Rallora layout and preserve the right action',()=>{
 assert.equal(types.length,13);
 for(const type of types){
  const {html,subject}=renderAuthEmail(type);
  assert.match(subject,/Rallora/);assert.match(html,/rallora-email-logo-final.png/);assert.match(html,/#061a39/);assert.match(html,/#00b0fe/);assert.match(html,/max-width:440px/);assert.match(html,/support@rallora.app/);assert.doesNotMatch(html,/rallora.invalid|POWERED BY/);
  if(type==='reauthentication'){assert.match(html,/{{ \.Token }}/);assert.doesNotMatch(html,/ConfirmationURL/);}
  else if(type.endsWith('_notification')){assert.match(html,/https:\/\/www.rallora.app\/account/);assert.match(html,/If you did not make this change/);assert.doesNotMatch(html,/ConfirmationURL/);}
  else{assert.equal((html.match(/{{ \.ConfirmationURL }}/g)||[]).length,1);assert.match(html,/href="{{ \.ConfirmationURL }}"/);assert.doesNotMatch(html,/TokenHash|RedirectTo|&amp;#123;/);}
 }
});
test('hosted settings contain exactly subjects and content with no auth behaviour changes',()=>{
 const config=authEmailTemplateConfig();assert.equal(Object.keys(config).length,26);
 for(const [key,value] of Object.entries(config)){assert.match(key,/^mailer_(subjects_[a-z_]+|templates_[a-z_]+_content)$/);assert.equal(typeof value,'string');assert.doesNotMatch(key,/enabled|smtp|site_url|redirect|secret|password_policy/);}
});
test('generated deployable files match the shared renderer exactly',()=>{
 for(const type of types)assert.equal(fs.readFileSync(new URL(`../supabase/templates/auth/${type}.html`,import.meta.url),'utf8'),renderAuthEmail(type).html+'\n');
 assert.deepEqual(JSON.parse(fs.readFileSync(new URL('../supabase/templates/auth/hosted-config.json',import.meta.url),'utf8')),authEmailTemplateConfig());
});
test('club emails retain their logo, colour, identity and powered-by footer',()=>{
 const html=renderClubEmail({name:'Synthetic Padel Club',logoUrl:'https://example.invalid/club.png',primaryColour:'#126734'},{preview:'League update',eyebrow:'LEAGUE',title:'Your fixtures',contentHtml:'<p>Ready to play.</p>'});
 assert.match(html,/Synthetic Padel Club/);assert.match(html,/#126734/);assert.match(html,/https:\/\/example.invalid\/club.png/);assert.match(html,/POWERED BY/);
});
