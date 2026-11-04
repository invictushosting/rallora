import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const baseline = JSON.parse(fs.readFileSync(new URL('docs/production-migration-baseline-2026-10-29.json', root), 'utf8'));
const files = fs.readdirSync(new URL('supabase/migrations/', root)).filter(file => file.endsWith('.sql'));
const versions = new Set();
for (const file of files) {
  const version = file.split('_')[0];
  assert.match(version, /^\d{14}$/);
  assert.ok(!versions.has(version), `Duplicate migration version: ${version}`);
  versions.add(version);
}
const observed = new Set();
for (const entry of baseline.entries) {
  assert.ok(!observed.has(entry.production_version), `Duplicate production version: ${entry.production_version}`);
  observed.add(entry.production_version);
  assert.equal(path.dirname(entry.source), 'supabase/migrations');
  assert.ok(fs.existsSync(new URL(entry.source, root)), `Missing production migration source: ${entry.source}`);
}
console.log(`Migration history: ${baseline.entries.length} production entries have source mappings; ${files.length} unique local versions.`);
