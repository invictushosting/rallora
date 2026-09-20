// Guard against accidentally exposing SECURITY DEFINER demo RPCs that choose
// the newest active season *globally*, including in the relocated GSM hub.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const paths = [
  "app/page.tsx",
  "app/clubs/gsm-padel/legacy/page.tsx",
  "app/clubs/[slug]/page.tsx",
  "app/clubs/[slug]/admin/page.tsx",
];
const forbidden = /\.rpc\(\s*["'](?:load_demo_club_data|reset_demo_data)["']/;
for (const path of paths) {
  if (forbidden.test(readFileSync(resolve(path), "utf8"))) {
    console.error(`Unsafe global-season demo/reset RPC found in ${path}`);
    process.exitCode = 1;
  }
}
if (!process.exitCode) console.log("No legacy global-season demo/reset RPC call sites.");
