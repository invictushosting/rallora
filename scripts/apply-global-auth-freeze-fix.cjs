const fs = require("fs");
const path = require("path");

const root = process.cwd();
const pagePath = path.join(root, "app", "page.tsx");
const onboardingPath = path.join(root, "app", "onboarding", "page.tsx");

function patchFile(filePath, patches) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipped missing file: ${filePath}`);
    return false;
  }

  let text = fs.readFileSync(filePath, "utf8");
  let changed = false;

  for (const patch of patches) {
    if (text.includes(patch.find)) {
      text = text.replace(patch.find, patch.replace);
      console.log(`Patched: ${patch.label}`);
      changed = true;
    } else {
      console.warn(`Marker not found: ${patch.label}`);
    }
  }

  if (changed) fs.writeFileSync(filePath, text);
  return changed;
}

const adminOld = `  useEffect(() => {
    let mounted = true;

    async function loadAuth() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      const authUser = data.user
        ? { id: data.user.id, email: data.user.email ?? undefined }
        : null;
      setUser(authUser);
      setAuthLoading(false);

      if (authUser) {
        const allowed = await checkAdminAccess();
        if (allowed) await refreshAdminData();
      }
    }

    loadAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const authUser = session?.user
          ? { id: session.user.id, email: session.user.email ?? undefined }
          : null;
        setUser(authUser);
        setIsAdmin(false);
        if (authUser) {
          const allowed = await checkAdminAccess();
          if (allowed) await refreshAdminData();
        }
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);`;

const adminNew = `  useEffect(() => {
    let mounted = true;

    async function loadAuth() {
      setAuthLoading(true);

      try {
        const authResult = await Promise.race([
          supabase.auth.getUser(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Admin session check timed out. Please sign in again.")), 6000),
          ),
        ]);

        const { data, error } = authResult;
        if (error) throw error;
        if (!mounted) return;

        const authUser = data.user
          ? { id: data.user.id, email: data.user.email ?? undefined }
          : null;

        setUser(authUser);

        if (authUser) {
          const allowed = await checkAdminAccess();
          if (allowed) await refreshAdminData();
        }
      } catch (error) {
        if (!mounted) return;
        setUser(null);
        setIsAdmin(false);
        showError(error instanceof Error ? error.message : "Could not check admin session.");
      } finally {
        if (mounted) setAuthLoading(false);
      }
    }

    loadAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const authUser = session?.user
          ? { id: session.user.id, email: session.user.email ?? undefined }
          : null;

        setUser(authUser);
        setIsAdmin(false);
        setAuthLoading(false);

        if (authUser) {
          const allowed = await checkAdminAccess();
          if (allowed) await refreshAdminData();
        }
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);`;

const captainOld = `  useEffect(() => {
    let mounted = true;

    async function loadAuth() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const authUser = data.user
        ? { id: data.user.id, email: data.user.email ?? undefined }
        : null;
      setUser(authUser);
      setAuthLoading(false);
      if (authUser) await loadCaptainData(authUser.email);
    }

    loadAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const authUser = session?.user
          ? { id: session.user.id, email: session.user.email ?? undefined }
          : null;
        setUser(authUser);
        setCaptainRecord(null);
        if (authUser) await loadCaptainData(authUser.email);
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);`;

const captainNew = `  useEffect(() => {
    let mounted = true;

    async function loadAuth() {
      setAuthLoading(true);

      try {
        const authResult = await Promise.race([
          supabase.auth.getUser(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Captain session check timed out. Please sign in again.")), 6000),
          ),
        ]);

        const { data, error } = authResult;
        if (error) throw error;
        if (!mounted) return;

        const authUser = data.user
          ? { id: data.user.id, email: data.user.email ?? undefined }
          : null;

        setUser(authUser);

        if (authUser) await loadCaptainData(authUser.email);
      } catch (error) {
        if (!mounted) return;
        setUser(null);
        setCaptainRecord(null);
        showError(error instanceof Error ? error.message : "Could not check captain session.");
      } finally {
        if (mounted) setAuthLoading(false);
      }
    }

    loadAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const authUser = session?.user
          ? { id: session.user.id, email: session.user.email ?? undefined }
          : null;

        setUser(authUser);
        setCaptainRecord(null);
        setAuthLoading(false);

        if (authUser) await loadCaptainData(authUser.email);
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);`;

let anyChanged = false;

anyChanged = patchFile(pagePath, [
  { label: "Admin auth timeout/loading fix", find: adminOld, replace: adminNew },
  { label: "Captain auth timeout/loading fix", find: captainOld, replace: captainNew },
]) || anyChanged;

// Patch onboarding session loader if that file exists and has the original checkSession block.
if (fs.existsSync(onboardingPath)) {
  let onboarding = fs.readFileSync(onboardingPath, "utf8");
  const start = onboarding.indexOf("  async function checkSession() {");
  const end = onboarding.indexOf("  async function signIn", start);

  if (start !== -1 && end !== -1) {
    const replacement = `  async function checkSession() {
    setUserState((prev) => ({ ...prev, loading: true }));
    setAuthError(null);

    try {
      const sessionResult = await Promise.race([
        supabase.auth.getUser(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Onboarding session check timed out. Please refresh or sign in again.")), 6000),
        ),
      ]);

      const { data: userData, error: userError } = sessionResult;
      if (userError) throw userError;

      const userEmail = userData.user?.email ?? null;

      if (!userEmail) {
        setUserState({ email: null, isAdmin: false, loading: false });
        return;
      }

      const { data: adminRows, error } = await supabase
        .from("admin_users")
        .select("email")
        .ilike("email", userEmail)
        .limit(1);

      setUserState({
        email: userEmail,
        isAdmin: !error && Boolean(adminRows?.length),
        loading: false,
      });

      if (error) {
        setAuthError("Signed in, but admin access could not be verified.");
      }
    } catch (error) {
      console.error("Onboarding session check failed", error);
      setAuthError(error instanceof Error ? error.message : "Could not check onboarding session.");
      setUserState({ email: null, isAdmin: false, loading: false });
    }
  }

`;
    onboarding = onboarding.slice(0, start) + replacement + onboarding.slice(end);
    fs.writeFileSync(onboardingPath, onboarding);
    console.log("Patched: Onboarding auth timeout/loading fix");
    anyChanged = true;
  } else {
    console.warn("Onboarding checkSession block not found; skipped.");
  }
}

if (!anyChanged) {
  console.error("No patches applied. Your file structure has changed, or this fix is already applied.");
  process.exit(1);
}

console.log("Rallora global auth freeze fix applied.");
