"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { UiVersionProvider } from "@/components/flags/ui-version-provider";
import { ConfirmProvider } from "@/hooks/use-confirm";
import { toastIcons } from "@/components/ui/toast-icons";
import type { UiVersion } from "@/lib/flags/ui-version.shared";
import { UpgradePromptHost } from "@/features/billing/upgrade-prompt";

export function Providers({
  children,
  uiVersion = "v1",
}: {
  children: React.ReactNode;
  uiVersion?: UiVersion;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <UiVersionProvider value={uiVersion}>
      <ConfirmProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <UpgradePromptHost />
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          icons={toastIcons}
          toastOptions={{
            classNames: {
              toast:
                "group !rounded-xl !border !border-zinc-800/80 !bg-zinc-900/95 !text-zinc-100 !shadow-xl !backdrop-blur-xl",
              title: "!text-sm !font-medium !text-zinc-100",
              description: "!text-xs !text-zinc-400",
              actionButton: "!rounded-lg !bg-sky-500 !text-white !text-xs",
              cancelButton: "!rounded-lg !bg-zinc-800 !text-zinc-300 !text-xs",
              closeButton:
                "!rounded-lg !border-zinc-700 !bg-zinc-800/80 !text-zinc-400 hover:!text-zinc-200",
            },
          }}
        />
      </QueryClientProvider>
      </ConfirmProvider>
    </UiVersionProvider>
  );
}
