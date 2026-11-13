import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20261027121500_signup_terms_acceptance_ledger.sql","utf8");
const signup = readFileSync("app/signup/page.tsx","utf8");
const clubEntry = readFileSync("app/clubs/[slug]/register/page.tsx","utf8");
const clubApply = readFileSync("app/register-club/page.tsx","utf8");

test("all three account-creation routes require affirmative terms acknowledgement",()=>{
  for(const source of [signup,clubEntry,clubApply]){
    assert.match(source, /acceptedTerms/);
    assert.match(source, /terms_accepted:true/);
    assert.match(source, /terms_version:"draft-2026-10-27"/);
    assert.match(source, /href="\/terms"/);
    assert.match(source, /href="\/privacy"/);
    assert.doesNotMatch(source, /terms_accepted_at:new Date/);
  }
});

test("signup ledger is non-client writable and server timestamped",()=>{
  assert.match(migration, /create table if not exists rallora_private\.player_terms_acceptance_events/);
  assert.match(migration, /accepted_at timestamptz not null default transaction_timestamp\(\)/);
  assert.match(migration, /on delete cascade/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on rallora_private\.player_terms_acceptance_events from public, anon, authenticated/);
  assert.match(migration, /after insert on auth\.users/);
  assert.match(migration, /new\.raw_user_meta_data ->> 'terms_accepted' = 'true'/);
  assert.doesNotMatch(migration, /grant (insert|update|delete) on rallora_private\.player_terms_acceptance_events to (anon|authenticated)/i);
});

test("draft document version is explicit and cannot be accepted silently",()=>{
  for(const source of [signup,clubEntry,clubApply]) assert.match(source,/!acceptedTerms/);
  assert.match(migration,/new\.raw_user_meta_data ->> 'terms_version' = 'draft-2026-10-27'/);
});
