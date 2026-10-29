import test from 'node:test';
import assert from 'node:assert/strict';
import {sendSupportRequest} from '../lib/support-request.ts';
const request={category:'general_help',subject:'Synthetic question',message:'Synthetic details only'};
test('support requires explicit server acknowledgement and sends a bounded request',async t=>{
 t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(url,'/api/support');assert.deepEqual(JSON.parse(options.body),request);assert.ok(options.signal instanceof AbortSignal);return Response.json({ok:true});});
 assert.equal((await sendSupportRequest(request)).ok,true);
});
test('network failures and invalid responses remain retryable without claiming success',async t=>{
 for(const response of [()=>{throw new TypeError('offline')},()=>new Response('<html>gateway failure</html>',{status:502}),()=>Response.json({})]){
  t.mock.method(globalThis,'fetch',async()=>response());const result=await sendSupportRequest(request);
  assert.equal(result.ok,false);assert.match(result.message,/message is still here/);t.mock.restoreAll();
 }
 t.mock.method(globalThis,'fetch',async()=>Response.json({ok:true}));assert.equal((await sendSupportRequest(request)).ok,true);
});
test('sign-in and validation errors keep the server recovery instruction',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({error:'Sign in first.'},{status:401}));
 assert.deepEqual(await sendSupportRequest(request),{ok:false,message:'Sign in first.'});
});
