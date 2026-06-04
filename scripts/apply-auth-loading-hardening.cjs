const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "page.tsx");
if (!fs.existsSync(pagePath)) {
  console.error("Could not find app/page.tsx. Run from the Rallora project root.");
  process.exit(1);
}

let page = fs.readFileSync(pagePath, "utf8");

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
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!mounted) return;
        if (error) throw error;

        const authUser = data.user
          ? { id: data.user.id, email: data.user.email ?? undefined }
          : null;
        setUser(authUser);

        if (authUser) {
          const allowed = await checkAdminAccess();
          if (allowed) await refreshAdminData();
        }
      } catch (error) {
        if (mounted) {
          setUser(null);
          setIsAdmin(false);
          showError(error instanceof Error ? error.message : "Could not check admin session.");
        }
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
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!mounted) return;
        if (error) throw error;
        const authUser = data.user
          ? { id: data.user.id, email: data.user.email ?? undefined }
          : null;
        setUser(authUser);
        if (authUser) await loadCaptainData(authUser.email);
      } catch (error) {
        if (mounted) {
          setUser(null);
          setCaptainRecord(null);
          showError(error instanceof Error ? error.message : "Could not check captain session.");
        }
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

let changed = false;

if (page.includes(adminOld)) {
  page = page.replace(adminOld, adminNew);
  changed = true;
  console.log("Patched admin auth loading.");
} else {
  console.warn("Admin auth block not found exactly. No admin auth patch applied.");
}

if (page.includes(captainOld)) {
  page = page.replace(captainOld, captainNew);
  changed = true;
  console.log("Patched captain auth loading.");
} else {
  console.warn("Captain auth block not found exactly. No captain auth patch applied.");
}

// Make the /admin route a normal entry point that still opens the SPA admin state for now.
// If a route file exists and still sends to a broken/old hash, keep it simple.
const adminRoutePath = path.join(process.cwd(), "app", "admin", "page.tsx");
if (fs.existsSync(adminRoutePath)) {
  fs.writeFileSync(adminRoutePath, `import { redirect } from "next/navigation";

export default function AdminRoutePage() {
  redirect("/#admin");
}
`);
  console.log("Confirmed /admin route redirects to admin dashboard state.");
}

if (!changed) {
  console.error("No auth blocks were patched. The file structure may have changed.");
  process.exit(1);
}

fs.writeFileSync(pagePath, page);
console.log("Rallora auth loading hardening applied.");
