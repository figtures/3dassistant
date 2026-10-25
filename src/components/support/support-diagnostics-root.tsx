"use client";

import { useEffect } from "react";
import { installClientDiagnosticsCapture } from "@/lib/support/client-capture";
import { SupportReportProvider } from "@/components/support/report-problem-modal";

export function SupportDiagnosticsRoot({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    installClientDiagnosticsCapture();
  }, []);

  return <SupportReportProvider>{children}</SupportReportProvider>;
}
