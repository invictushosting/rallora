"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import RalloraLoader from "./rallora-loader";

export default function NavigationLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, [pathname]);

  useEffect(() => {
    let failsafe: number | undefined;

    function stopSoon() {
      if (failsafe) window.clearTimeout(failsafe);
      failsafe = window.setTimeout(() => setLoading(false), 3500);
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin) return;
      const current = new URL(window.location.href);
      if (next.href === current.href || (next.pathname === current.pathname && next.search === current.search && next.hash)) return;

      setLoading(true);
      stopSoon();
    }

    function onPageHide() {
      setLoading(true);
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onPageHide);
      if (failsafe) window.clearTimeout(failsafe);
    };
  }, []);

  return loading ? <RalloraLoader overlay /> : null;
}
