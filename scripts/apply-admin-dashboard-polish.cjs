const fs = require('fs');
const path = require('path');

const root = process.cwd();
const pagePath = path.join(root, 'app', 'page.tsx');
const cssPath = path.join(root, 'app', 'globals.css');

if (!fs.existsSync(pagePath)) {
  console.error('Could not find app/page.tsx. Run this script from the Rallora project root.');
  process.exit(1);
}
if (!fs.existsSync(cssPath)) {
  console.error('Could not find app/globals.css. Run this script from the Rallora project root.');
  process.exit(1);
}

let page = fs.readFileSync(pagePath, 'utf8');
const startMarker = '{activeAdminTab === "overview" && (';
const nextMarkers = [
  '{activeAdminTab === "settings"',
  '{activeAdminTab === "setup"',
  '{activeAdminTab === "quick"',
];
const start = page.indexOf(startMarker);
if (start === -1) {
  console.error('Could not find the existing Admin Overview block. No changes made.');
  process.exit(1);
}
let end = -1;
for (const marker of nextMarkers) {
  const idx = page.indexOf(marker, start + startMarker.length);
  if (idx !== -1 && (end === -1 || idx < end)) end = idx;
}
if (end === -1) {
  console.error('Could not find the end of the Admin Overview block. No changes made.');
  process.exit(1);
}

const replacement = String.raw`{activeAdminTab === "overview" && (
        <div className="admin-dashboard-polish">
          <div className="admin-hero-panel">
            <div>
              <span className="admin-eyebrow">Rallora control centre</span>
              <h2>{club.name} Admin Hub</h2>
              <p>
                Manage club setup, leagues, fixtures, captain submissions, sponsors, rules and demo tools from one organised dashboard.
              </p>
            </div>
            <div className="admin-hero-actions">
              <button type="button" className="primary-button" onClick={() => setActiveAdminTab("quick")}>
                Add Teams / Fixtures
              </button>
              <button type="button" className="secondary-button" onClick={() => setActiveAdminTab("fixtures")}>
                Generate Fixtures
              </button>
              <button type="button" className="secondary-button" onClick={() => { window.location.href = "/admin/rules"; }}>
                Edit Rules
              </button>
            </div>
          </div>

          <div className="admin-stat-grid enhanced">
            <div className="admin-stat-card">
              <Trophy size={24} />
              <span>Active Season</span>
              <strong>{allSeasons.find((season) => season.status === "active")?.name ?? "No active season"}</strong>
              <button type="button" onClick={() => setActiveAdminTab("setup")}>Manage seasons</button>
            </div>
            <div className="admin-stat-card">
              <Swords size={24} />
              <span>Leagues</span>
              <strong>{adminDivisions.length}</strong>
              <button type="button" onClick={() => setActiveAdminTab("setup")}>Sort / edit leagues</button>
            </div>
            <div className="admin-stat-card">
              <Users size={24} />
              <span>Teams</span>
              <strong>{adminTeams.length}</strong>
              <button type="button" onClick={() => setActiveAdminTab("quick")}>Add teams</button>
            </div>
            <div className="admin-stat-card">
              <CalendarDays size={24} />
              <span>Fixtures</span>
              <strong>{adminFixtures.length}</strong>
              <button type="button" onClick={() => setActiveAdminTab("fixtures")}>Fixture tools</button>
            </div>
            <div className="admin-stat-card">
              <ClipboardList size={24} />
              <span>Results</span>
              <strong>{adminResults.length}</strong>
              <button type="button" onClick={() => setActiveAdminTab("quick")}>Submit result</button>
            </div>
            <div className="admin-stat-card">
              <Bell size={24} />
              <span>Captain Submissions</span>
              <strong>{captainSubmissions.length}</strong>
              <button type="button" onClick={() => setActiveAdminTab("captains")}>Review submissions</button>
            </div>
          </div>

          <div className="admin-overview-grid polished">
            <Card>
              <SectionTitle icon={Settings} title="Quick Actions" />
              <div className="admin-action-grid">
                <button type="button" onClick={() => setActiveAdminTab("settings")}>
                  <Settings size={20} />
                  <strong>Club Settings</strong>
                  <span>Logo, colours, contact details and public copy.</span>
                </button>
                <button type="button" onClick={() => setActiveAdminTab("setup")}>
                  <Trophy size={20} />
                  <strong>Seasons & Leagues</strong>
                  <span>Create seasons, add leagues and manage order.</span>
                </button>
                <button type="button" onClick={() => setActiveAdminTab("fixtures")}>
                  <CalendarDays size={20} />
                  <strong>Fixture Generator</strong>
                  <span>Weekly rounds, monthly packs and fixture previews.</span>
                </button>
                <button type="button" onClick={() => setActiveAdminTab("cup")}>
                  <Medal size={20} />
                  <strong>League Cup</strong>
                  <span>Qualification rules, manual qualifiers and cup setup.</span>
                </button>
                <button type="button" onClick={() => setActiveAdminTab("sponsors")}>
                  <ShieldCheck size={20} />
                  <strong>Sponsors</strong>
                  <span>Logo uploads, placements and sponsor links.</span>
                </button>
                <button type="button" onClick={() => setActiveAdminTab("demo")}>
                  <RefreshCw size={20} />
                  <strong>Demo Tools</strong>
                  <span>Load demo teams, fixtures and sample results.</span>
                </button>
              </div>
            </Card>

            <Card>
              <SectionTitle icon={CheckCircle2} title="Setup Checklist" />
              <div className="setup-checklist-polished">
                <div className={club.logoUrl ? "complete" : "warning"}>
                  <CheckCircle2 size={18} />
                  <span>Club branding</span>
                  <strong>{club.logoUrl ? "Ready" : "Add logo"}</strong>
                </div>
                <div className={clubRulesSummary ? "complete" : "warning"}>
                  <CheckCircle2 size={18} />
                  <span>Rules configured</span>
                  <strong>{clubRulesSummary ? String(clubRulesSummary.win_points ?? 3) + " pts/win" : "Review"}</strong>
                </div>
                <div className={adminDivisions.length > 0 ? "complete" : "warning"}>
                  <CheckCircle2 size={18} />
                  <span>Leagues created</span>
                  <strong>{adminDivisions.length}</strong>
                </div>
                <div className={adminTeams.length > 0 ? "complete" : "warning"}>
                  <CheckCircle2 size={18} />
                  <span>Teams added</span>
                  <strong>{adminTeams.length}</strong>
                </div>
                <div className={adminFixtures.length > 0 ? "complete" : "warning"}>
                  <CheckCircle2 size={18} />
                  <span>Fixtures generated</span>
                  <strong>{adminFixtures.length}</strong>
                </div>
                <div className={adminSponsors.length > 0 ? "complete" : "warning"}>
                  <CheckCircle2 size={18} />
                  <span>Sponsors added</span>
                  <strong>{adminSponsors.length}</strong>
                </div>
              </div>
              <div className="button-row checklist-actions">
                <button type="button" className="secondary-button" onClick={handleManualRecalculate}>
                  Recalculate Tables
                </button>
                <button type="button" className="secondary-button" onClick={() => { window.open("/rules", "_blank"); }}>
                  View Public Rules
                </button>
              </div>
            </Card>
          </div>
        </div>
      )}

      `;

page = page.slice(0, start) + replacement + page.slice(end);
fs.writeFileSync(pagePath, page);

let css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* Rallora admin dashboard polish */';
const cssAdd = String.raw`

/* Rallora admin dashboard polish */
.admin-dashboard-polish {
  display: grid;
  gap: 1.25rem;
}

.admin-hero-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 1.35rem;
  border-radius: 1.4rem;
  background: linear-gradient(135deg, #06162e 0%, #0f3b78 58%, #1f7ae0 100%);
  color: #fff;
  box-shadow: 0 18px 45px rgba(7, 36, 83, 0.22);
}

.admin-hero-panel h2 {
  margin: 0.25rem 0 0.4rem;
  font-size: clamp(1.45rem, 3vw, 2.2rem);
  line-height: 1;
}

.admin-hero-panel p {
  margin: 0;
  max-width: 760px;
  color: rgba(255,255,255,0.78);
}

.admin-eyebrow {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.35rem 0.65rem;
  background: rgba(255,255,255,0.13);
  color: rgba(255,255,255,0.86);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.admin-hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.65rem;
  min-width: 260px;
}

.admin-hero-actions .secondary-button {
  background: rgba(255,255,255,0.12);
  color: #fff;
  border-color: rgba(255,255,255,0.22);
}

.admin-stat-grid.enhanced {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.9rem;
}

.admin-stat-card {
  display: grid;
  gap: 0.45rem;
  min-height: 150px;
  padding: 1rem;
  border: 1px solid rgba(15, 68, 128, 0.12);
  border-radius: 1.1rem;
  background: #fff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.admin-stat-card svg {
  color: var(--club-primary, #1f7ae0);
}

.admin-stat-card span {
  color: #64748b;
  font-size: 0.77rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.admin-stat-card strong {
  color: #0f172a;
  font-size: 1.35rem;
  line-height: 1.05;
}

.admin-stat-card button {
  align-self: end;
  justify-self: start;
  border: 0;
  background: transparent;
  color: var(--club-primary, #1f7ae0);
  font-weight: 900;
  cursor: pointer;
  padding: 0;
}

.admin-overview-grid.polished {
  grid-template-columns: minmax(0, 1.25fr) minmax(330px, 0.75fr);
  align-items: start;
}

.admin-action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.admin-action-grid button {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas:
    "icon title"
    "icon body";
  column-gap: 0.75rem;
  row-gap: 0.2rem;
  width: 100%;
  padding: 0.95rem;
  border: 1px solid rgba(15, 68, 128, 0.12);
  border-radius: 1rem;
  background: #f8fafc;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.admin-action-grid button:hover {
  transform: translateY(-1px);
  border-color: rgba(31, 122, 224, 0.28);
  background: #eef6ff;
}

.admin-action-grid svg {
  grid-area: icon;
  margin-top: 0.1rem;
  color: var(--club-primary, #1f7ae0);
}

.admin-action-grid strong {
  grid-area: title;
  color: #0f172a;
}

.admin-action-grid span {
  grid-area: body;
  color: #64748b;
  font-size: 0.88rem;
  line-height: 1.35;
}

.setup-checklist-polished {
  display: grid;
  gap: 0.65rem;
}

.setup-checklist-polished > div {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.65rem;
  padding: 0.75rem;
  border-radius: 0.95rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.setup-checklist-polished > div.complete svg {
  color: #16a34a;
}

.setup-checklist-polished > div.warning svg {
  color: #f59e0b;
}

.setup-checklist-polished span {
  color: #334155;
  font-weight: 800;
}

.setup-checklist-polished strong {
  color: #0f172a;
  font-size: 0.9rem;
}

.checklist-actions {
  margin-top: 1rem;
}

@media (max-width: 1100px) {
  .admin-stat-grid.enhanced {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .admin-overview-grid.polished {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .admin-hero-panel {
    align-items: stretch;
    flex-direction: column;
  }
  .admin-hero-actions {
    justify-content: stretch;
    min-width: 0;
  }
  .admin-hero-actions button {
    width: 100%;
  }
  .admin-stat-grid.enhanced,
  .admin-action-grid {
    grid-template-columns: 1fr;
  }
}
`;

if (!css.includes(marker)) {
  fs.appendFileSync(cssPath, cssAdd);
}

console.log('Rallora admin dashboard polish applied.');
