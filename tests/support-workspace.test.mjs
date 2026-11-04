import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {playerAccessChecks,matchesSupportSearch} from '../lib/support-workspace.ts';
import {verifySupportWebhook,supportReplyToken,supportSender,supportEmailText} from '../lib/support-inbound.ts';
const team={id:'team',active:true,hasAccess:false,fixtures:3,openFixtures:3};
const player={userId:'account',confirmedAt:'2026-10-23',teams:[team],invites:[{status:'pending',teamId:'team'}]};
test('distinguishes account creation from joining an approved team',()=>{
 assert.deepEqual(playerAccessChecks(player),['Account confirmed','Team invitation unclaimed','No team access linked','Open fixtures available']);
 assert.ok(playerAccessChecks({...player,teams:[{...team,hasAccess:true}],invites:[]}).includes('Team access linked'));
 assert.ok(playerAccessChecks({...player,teams:[]}).includes('No active team found'));
 assert.ok(!playerAccessChecks({...player,teams:[{...team,active:false}]}).includes('Team invitation unclaimed'));
});
test('ticket search matches names, emails, notes and all query terms',()=>{
 const ticket={id:'abc123',subject:'Cannot find chat',requester_name:'Example Player',requester_email:'example@example.test',message:'Registration help',internal_notes:'Invitation unclaimed',assignee:'Admin'};
 assert.ok(matchesSupportSearch(ticket,'EXAMPLE unclaimed'));
 assert.ok(matchesSupportSearch(ticket,'abc123'));
 assert.ok(!matchesSupportSearch(ticket,'example unrelated'));
});
test('inbound signature accepts authenticated fresh payloads and rejects tampering or replay',()=>{
 const raw=JSON.stringify({type:'email.received'}),now=1800000000000,timestamp=String(now/1000),key=Buffer.alloc(32,7),secret=`whsec_${key.toString('base64')}`;
 const signature=createHmac('sha256',key).update(`evt_1.${timestamp}.${raw}`).digest('base64');
 const headers=new Headers({'svix-id':'evt_1','svix-timestamp':timestamp,'svix-signature':`v1,${signature}`});
 assert.equal(verifySupportWebhook(raw,headers,secret,now),true);
 assert.equal(verifySupportWebhook(raw+' ',headers,secret,now),false);
 assert.equal(verifySupportWebhook(raw,headers,secret,now+301000),false);
 assert.equal(verifySupportWebhook(raw,new Headers(),secret,now),false);
 assert.equal(verifySupportWebhook(raw,headers,'whsec_bad',now),false);
});
test('reply routing requires the full secret token and configured receiving domain',()=>{
 const token='11111111-1111-1111-1111-111111111111';
 assert.equal(supportReplyToken([`support+${token}@replies.example.test`],'replies.example.test'),token);
 assert.equal(supportReplyToken([`support+${token}@attacker.test`],'replies.example.test'),null);
 assert.equal(supportReplyToken(['support@example.test'],'example.test'),null);
 assert.equal(supportSender('Example Player <PLAYER@EXAMPLE.TEST>'),'player@example.test');
 assert.equal(supportSender('bad <input>'),null);
 assert.ok(!supportEmailText({html:'<script>danger()</script><p>Hello</p>'}).includes('danger'));
 assert.ok(supportEmailText({text:'a'.repeat(20000)}).length<=10000);
 assert.match(supportEmailText({text:'Hello',attachments:[{}]}),/not imported/);
});
