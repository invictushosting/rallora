import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync("supabase/migrations/20261027130000_privacy_rights_request_intake.sql","utf8");
const page=readFileSync("app/account/privacy/page.tsx","utf8");
const account=readFileSync("app/account/page.tsx","utf8");

test("privacy requests are authenticated and identity scoped",()=>{
  assert.match(sql,/user_id uuid not null references auth\.users\(id\)/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/from anon/);
  assert.match(sql,/for insert to authenticated[\s\S]*?with check \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.match(sql,/for select to authenticated[\s\S]*?using \(user_id = \(select auth\.uid\(\)\)\)/);
});
test("clients cannot mutate internal review fields",()=>{
  assert.match(sql,/grant insert \(user_id,request_type,details\)/);
  assert.match(sql,/grant select \(id,user_id,request_type,details,status,created_at,updated_at,closed_at\)/);
  assert.doesNotMatch(sql,/grant (update|delete)/i);
});
test("no automatic account deletion, privacy page connected to account",()=>{
  assert.match(page,/db\.auth\.getUser\(\)/);
  assert.match(page,/db\.from\("rallora_privacy_requests"\)/);
  assert.match(page,/not automatic/);
  assert.match(account,/href="\/account\/privacy"/);
});
