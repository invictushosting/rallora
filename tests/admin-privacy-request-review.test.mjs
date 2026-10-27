import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync("supabase/migrations/20261027134500_admin_privacy_request_review.sql","utf8");
const page=readFileSync("app/platform/privacy/page.tsx","utf8");
const platform=readFileSync("app/platform/page.tsx","utf8");

test("admin privacy functions deny users without platform administrator membership",()=>{
 assert.equal((sql.match(/auth\.uid\(\) is null or not exists\(/g)||[]).length,2);
 assert.equal((sql.match(/from public\.rallora_platform_admins a where a\.user_id=auth\.uid\(\)/g)||[]).length,2);
 assert.match(sql,/revoke all on function public\.rallora_admin_list_privacy_requests\(\) from public,anon/);
 assert.match(sql,/revoke all on function public\.rallora_admin_update_privacy_request\(uuid,text,text\) from public,anon/);
});
test("rights review status changes generate server-side audit events",()=>{
 assert.match(sql,/insert into rallora_private\.privacy_request_events/);
 assert.ok(sql.includes('actor_user_id uuid references auth.users(id) on delete set null'));
 assert.match(sql,/previous_status text not null/);
 assert.match(sql,/next_status text not null/);
 assert.match(sql,/event_at timestamptz not null default transaction_timestamp\(\)/);
 assert.match(sql,/status in \('completed','declined'\)/);
});
test("admin UI is linked and does not expose automatic deletion",()=>{
 assert.match(platform,/href="\/platform\/privacy"/);
 assert.match(page,/rallora_admin_list_privacy_requests/);
 assert.match(page,/rallora_admin_update_privacy_request/);
 assert.match(page,/rallora_platform_admins/);
 assert.match(page,/does not/);
 assert.doesNotMatch(page,/auth\.admin\.deleteUser/);
});
