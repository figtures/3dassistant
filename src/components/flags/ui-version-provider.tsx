"use client";

import { createContext, useContext } from "react";
import type { UiVersion } from "@/lib/flags/ui-version.shared";

const UiVersionContext = createContext<UiVersion>("v1");

export function UiVersionProvider({
  value,
  children,
}: {
  value: UiVersion;
  children: React.ReactNode;
}) {
  return (
    <UiVersionContext.Provider value={value}>
      {children}
    </UiVersionContext.Provider>
  );
}

export function useUiVersion(): UiVersion {
  return useContext(UiVersionContext);
}
