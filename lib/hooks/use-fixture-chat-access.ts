"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

// Discovery only: the conversation RPC and RLS recheck fixture membership.
export function useFixtureChatAccess(clubId: string | null) {
  const db = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<{ clubId: string | null; teamIds: Set<string>; manager: boolean }>({ clubId: null, teamIds: new Set(), manager: false });
  useEffect(() => {
    let active = true, version = 0;
    async function load() {
      const current = ++version;
      if (!clubId) return;
      try {
        const auth = await db.auth.getUser();
        if (auth.error || !auth.data.user) return;
        const [roster, manager] = await Promise.all([
          db.from("rallora_team_roster_memberships").select("team_id").eq("club_id", clubId).eq("player_user_id", auth.data.user.id),
          db.rpc("rallora_can_manage_club", { p_club_id: clubId }),
        ]);
        if (active && current === version) setAccess({ clubId,
          teamIds: new Set((roster.error ? [] : roster.data ?? []).map(row => row.team_id)),
          manager: !manager.error && manager.data === true });
      } catch {
        // Public fixtures remain usable if private chat discovery is unavailable.
      }
    }
    void load();
    const listener = db.auth.onAuthStateChange(() => {
      version++;
      setAccess({ clubId: null, teamIds: new Set(), manager: false });
      queueMicrotask(() => { if (active) void load(); });
    });
    return () => { active = false; version++; listener.data.subscription.unsubscribe(); };
  }, [clubId, db]);
  return access.clubId === clubId ? access : { teamIds: new Set<string>(), manager: false };
}
