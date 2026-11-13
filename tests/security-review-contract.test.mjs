import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const note=readFileSync("docs/legal/database-security-review-2026-10-27.md","utf8");
test("public club-event RLS dependency is documented before function privileges are changed",()=>{
 assert.match(note,/published_events_public_read/);
 assert.match(note,/rallora_club_feature_enabled/);
 assert.match(note,/revoking anonymous function execute/);
 assert.match(note,/Do not apply generic revoke instructions/);
});
