"use client";

import dynamic from "next/dynamic";

export const UpgradePromptHostLazy = dynamic(
  () =>
    import("@/features/billing/upgrade-prompt").then((m) => ({
      default: m.UpgradePromptHost,
    })),
  { ssr: false }
);
