import test from 'node:test';
import assert from 'node:assert/strict';
import { sendRalloraEmail, escapeEmailHtml, isEmailAddress } from '../lib/email.ts';

const message={to:'captain@example.test',subject:'Fixture update',html:'<p>Ready</p>'};
async function withSender(t,handler,run){
  const old=process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY='test-key-never-sent';
  t.mock.method(globalThis,'fetch',handler);
  try {await run();} finally {t.mock.restoreAll();if(old===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=old;}
}
test('retries a transient provider failure with identical body and idempotency key',async t=>{
  const calls=[];
  await withSender(t,async(url,options)=>{calls.push({url,...options});return calls.length===1?new Response('{}',{status:500}):Response.json({id:'accepted-1'});},async()=>{
    assert.deepEqual(await sendRalloraEmail(message),{id:'accepted-1'});
    assert.equal(calls.length,2);assert.equal(calls[0].body,calls[1].body);
    assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);
    assert.ok(calls[0].signal instanceof AbortSignal);
  });
});
test('network uncertainty retries safely; authentication errors do not retry',async t=>{
  let calls=0;
  await withSender(t,async()=>{if(++calls===1)throw new TypeError('Connection lost');return Response.json({id:'accepted-2'});},async()=>{assert.equal((await sendRalloraEmail(message)).id,'accepted-2');assert.equal(calls,2);});
  calls=0;
  await withSender(t,async()=>{calls++;return new Response('{}',{status:401});},async()=>{await assert.rejects(sendRalloraEmail(message));assert.equal(calls,1);});
});
test('rate limits retry, but a long Retry-After does not trigger an early retry',async t=>{
  let calls=0;
  await withSender(t,async()=>++calls===1?new Response('{}',{status:429,headers:{'Retry-After':'0'}}):Response.json({id:'accepted-3'}),async()=>{await sendRalloraEmail(message);assert.equal(calls,2);});
  calls=0;
  await withSender(t,async()=>{calls++;return new Response('{}',{status:429,headers:{'Retry-After':'60'}});},async()=>{await assert.rejects(sendRalloraEmail(message));assert.equal(calls,1);});
});
test('missing acceptance IDs are not reported as success and retries are bounded',async t=>{
  let calls=0;
  await withSender(t,async()=>{calls++;return Response.json({});},async()=>{await assert.rejects(sendRalloraEmail(message));assert.equal(calls,3);});
});
test('invalid recipients never reach the provider and HTML values are escaped',async t=>{
  let calls=0;
  await withSender(t,async()=>{calls++;return Response.json({id:'unexpected'});},async()=>{await assert.rejects(sendRalloraEmail({...message,to:'bad\r\nrecipient'}));assert.equal(calls,0);});
  assert.equal(escapeEmailHtml('<Club & "Partners">'), '&lt;Club &amp; &quot;Partners&quot;&gt;');
  assert.equal(isEmailAddress('captain@example.test'),true);assert.equal(isEmailAddress('invalid@'),false);
});

test('missing delivery configuration fails without making a request',async t=>{
  const old=process.env.RESEND_API_KEY;delete process.env.RESEND_API_KEY;let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({id:'unexpected'});});
  try {await assert.rejects(sendRalloraEmail(message),/not configured/);assert.equal(calls,0);}
  finally {t.mock.restoreAll();if(old!==undefined)process.env.RESEND_API_KEY=old;}
});
