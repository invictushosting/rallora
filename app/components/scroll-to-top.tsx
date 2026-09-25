"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function ScrollToTop() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, searchParams]);

  useEffect(() => {
    const handler = () => window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    window.addEventListener("rallora:action-complete", handler);
    return () => window.removeEventListener("rallora:action-complete", handler);
  }, []);

  return null;
}
