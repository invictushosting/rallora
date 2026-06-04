const fs = require("fs");
const path = require("path");

const root = process.cwd();
const pagePath = path.join(root, "app", "page.tsx");
const onboardingPath = path.join(root, "app", "onboarding", "page.tsx");

function insertInFunction(source, functionName, anchor, insert, markerName) {
  const functionStart = source.indexOf(`function ${functionName}`);
  if (functionStart === -1) {
    console.warn(`Could not find ${functionName}.`);
    return { source, changed: false };
  }

  const anchorIndex = source.indexOf(anchor, functionStart);
  if (anchorIndex === -1) {
    console.warn(`Could not find anchor for ${functionName}: ${anchor}`);
    return { source, changed: false };
  }

  const alreadyIndex = source.indexOf(markerName, functionStart);
  const nextFunctionIndex = source.indexOf("\nfunction ", functionStart + 10);
  const functionEnd = nextFunctionIndex === -1 ? source.length : nextFunctionIndex;

  if (alreadyIndex !== -1 && alreadyIndex < functionEnd) {
    console.log(`${functionName} already has ${markerName}.`);
    return { source, changed: false };
  }

  const insertAt = anchorIndex + anchor.length;
  return {
    source: source.slice(0, insertAt) + insert + source.slice(insertAt),
    changed: true,
  };
}

let changed = false;

if (!fs.existsSync(pagePath)) {
  console.error("Could not find app/page.tsx. Run from the Rallora project root.");
  process.exit(1);
}

let page = fs.readFileSync(pagePath, "utf8");

const adminAnchor = '  const [authLoading, setAuthLoading] = useState(true);\n';
const adminInsert = `
  // Rallora auth failsafe: prevents Admin from freezing forever if Supabase auth stalls.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAuthLoading(false);
    }, 6500);

    return () => window.clearTimeout(timer);
  }, []);
`;

let result = insertInFunction(
  page,
  "AdminPage",
  adminAnchor,
  adminInsert,
  "Rallora auth failsafe: prevents Admin",
);
page = result.source;
changed = changed || result.changed;

const captainAnchor = '  const [authLoading, setAuthLoading] = useState(true);\n';
const captainInsert = `
  // Rallora auth failsafe: prevents Captain from freezing forever if Supabase auth stalls.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAuthLoading(false);
    }, 6500);

    return () => window.clearTimeout(timer);
  }, []);
`;

result = insertInFunction(
  page,
  "CaptainPage",
  captainAnchor,
  captainInsert,
  "Rallora auth failsafe: prevents Captain",
);
page = result.source;
changed = changed || result.changed;

fs.writeFileSync(pagePath, page);

if (fs.existsSync(onboardingPath)) {
  let onboarding = fs.readFileSync(onboardingPath, "utf8");

  if (!onboarding.includes("Rallora onboarding failsafe")) {
    const userStateMarker = /const \[userState,\s*setUserState\][^\n]*\n/;
    const match = onboarding.match(userStateMarker);

    if (match) {
      const insert = `
  // Rallora onboarding failsafe: prevents the wizard from freezing forever on auth check.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUserState((prev) => ({ ...prev, loading: false }));
    }, 6500);

    return () => window.clearTimeout(timer);
  }, []);
`;
      onboarding = onboarding.replace(match[0], match[0] + insert);
      fs.writeFileSync(onboardingPath, onboarding);
      console.log("Patched onboarding auth failsafe.");
      changed = true;
    } else {
      console.warn("Could not find onboarding userState state line.");
    }
  } else {
    console.log("Onboarding failsafe already exists.");
  }
}

if (!changed) {
  console.warn("No new changes made. The failsafe may already be applied.");
}

console.log("Rallora auth failsafe patch complete.");
