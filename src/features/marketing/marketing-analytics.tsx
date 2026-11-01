"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

export function MarketingAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/" || pathname === "/pricing") {
      track("landing_view", { path: pathname });
    }
  }, [pathname]);

  return null;
}
