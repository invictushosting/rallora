// Guard against accidentally re-enabling legacy global-season demo RPCs from a client.
 // Those SECURITY DEFINER RPCs select the newest active season across ALL clubs.
 // A disabled HTML button is not sufficient protection; this guard detects direct call sites.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const source = readFileSync(resolve("app/page.tsx"), "utf8");
const forbidden = /\.rpc\(\s*["'](?:load_demo_club_data|reset_demo_data)["']/g;
if (forbidden.test(source)) {
  console.error("Unsafe legacy global-season demo/reset RPC is callable from app/page.tsx.");
  process.exitCode = 1;
} else {
  console.log("No legacy global-season demo/reset RPC call sites found in app/page.tsx.");
}
