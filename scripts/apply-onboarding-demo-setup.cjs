const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "onboarding", "page.tsx");
if (!fs.existsSync(pagePath)) {
  console.error("Could not find app/onboarding/page.tsx. Run this from the Rallora project root.");
  process.exit(1);
}

let page = fs.readFileSync(pagePath, "utf8");
let changed = false;

function replaceOnce(find, replace, label) {
  if (!page.includes(find)) {
    console.warn(`Skipped ${label}: marker not found.`);
    return false;
  }
  page = page.replace(find, replace);
  console.log(`Patched ${label}.`);
  changed = true;
  return true;
}

// 1) Add demo setup checkbox state.
replaceOnce(
  '  const [createdSummary, setCreatedSummary] = useState<CreatedSummary | null>(null);\n',
  '  const [createdSummary, setCreatedSummary] = useState<CreatedSummary | null>(null);\n  const [createDemoSetup, setCreateDemoSetup] = useState(true);\n',
  "create demo setup state"
);

// 2) Call the onboarding demo RPC after rules/profile setup and before success summary.
const rpcMarker = `      if (rulesError) {
        // Non-critical: core setup is already created.
        console.warn("club_rules insert failed", rulesError.message);
      }

      setCreatedSummary({`;

const rpcPatch = `      if (rulesError) {
        // Non-critical: core setup is already created.
        console.warn("club_rules insert failed", rulesError.message);
      }

      if (createDemoSetup) {
        const { error: demoError } = await supabase.rpc("load_onboarding_demo_data", {
          p_club_id: club.id,
          p_season_id: season.id,
          p_teams_per_league: Math.max(4, Math.min(12, Math.round(cleanLeagues[0]?.teamsPerLeague ?? 8))),
          p_fixtures_per_team: Number(fixturesPerPack) || 3,
        });

        if (demoError) throw new Error(\`Club was created, but demo setup failed: \${demoError.message}\`);
      }

      setCreatedSummary({`;

replaceOnce(rpcMarker, rpcPatch, "demo RPC call");

// 3) Make success message mention demo data.
replaceOnce(
  '      setSubmitMessage("Club setup created successfully.");',
  '      setSubmitMessage(createDemoSetup ? "Club setup and demo data created successfully." : "Club setup created successfully.");',
  "success message"
);

// 4) Add demo option to review panel.
const summaryMarker = `                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Leagues</dt><dd className="font-black">{leagues.filter((league) => league.name.trim()).length}</dd></div>
                  </dl>
                </div>
                <div className="rounded-[1.5rem] border border-blue-200 bg-blue-50 p-5">
                  <Users className="h-8 w-8 text-blue-600" />
                  <h3 className="mt-3 font-black uppercase text-blue-950">What happens next?</h3>
                  <p className="mt-2 text-sm font-semibold text-blue-900/70">After creation, go to the main admin area to add teams, captains, sponsors, fixtures and demo data for this club.</p>
                </div>`;

const summaryPatch = `                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Leagues</dt><dd className="font-black">{leagues.filter((league) => league.name.trim()).length}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Demo setup</dt><dd className="font-black">{createDemoSetup ? "Included" : "Skipped"}</dd></div>
                  </dl>
                  <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-200 bg-white p-4 text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={createDemoSetup}
                      onChange={(event) => setCreateDemoSetup(event.target.checked)}
                      className="mt-1 h-5 w-5"
                    />
                    <span>
                      <span className="block font-black uppercase text-blue-950">Create demo setup</span>
                      <span className="mt-1 block text-slate-500">
                        Adds demo teams, captains, fixtures, two rounds of results, standings, sponsors and cup qualifier rules for sales demos.
                      </span>
                    </span>
                  </label>
                </div>
                <div className="rounded-[1.5rem] border border-blue-200 bg-blue-50 p-5">
                  <Users className="h-8 w-8 text-blue-600" />
                  <h3 className="mt-3 font-black uppercase text-blue-950">What happens next?</h3>
                  <p className="mt-2 text-sm font-semibold text-blue-900/70">
                    {createDemoSetup
                      ? "This club will be ready to demo immediately with teams, fixtures, results, standings, sponsors and cup setup."
                      : "After creation, go to the main admin area to add teams, captains, sponsors, fixtures and results."}
                  </p>
                </div>`;

replaceOnce(summaryMarker, summaryPatch, "review demo checkbox");

// 5) Add demo info to created summary.
const createdMarker = `                  <div className="rounded-2xl bg-white p-4">
                    <div className="text-xs font-black uppercase text-green-700">Leagues</div>
                    <div className="font-black">{createdSummary.leaguesCreated.join(", ")}</div>
                  </div>
                </div>
              </div>`;

const createdPatch = `                  <div className="rounded-2xl bg-white p-4">
                    <div className="text-xs font-black uppercase text-green-700">Leagues</div>
                    <div className="font-black">{createdSummary.leaguesCreated.join(", ")}</div>
                  </div>
                  <div className="rounded-2xl bg-white p-4 md:col-span-2">
                    <div className="text-xs font-black uppercase text-green-700">Demo setup</div>
                    <div className="font-black">{createDemoSetup ? "Teams, fixtures, results, sponsors and cup rules loaded" : "Skipped"}</div>
                  </div>
                </div>
              </div>`;

replaceOnce(createdMarker, createdPatch, "created demo summary");

if (!changed) {
  console.error("No changes were made. The onboarding page may already be patched or has changed structure.");
  process.exit(1);
}

fs.writeFileSync(pagePath, page);
console.log("Rallora onboarding demo setup patch complete.");
