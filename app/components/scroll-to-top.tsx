"use client";

import { useLayoutEffect, useEffect } from "react";
import { usePathname } from "next/navigation";

function resetScroll(behavior: ScrollBehavior = "auto") {
  window.scrollTo({ top: 0, left: 0, behavior });
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior });
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior }));
  });
  window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior }), 80);
}

export default function ScrollToTop() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    resetScroll("auto");
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, [pathname]);

  useEffect(() => {
    const handler = () => resetScroll("smooth");
    window.addEventListener("rallora:action-complete", handler);
    return () => window.removeEventListener("rallora:action-complete", handler);
  }, []);

  return null;
}
