"use client";

import type { ReactNode } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { can, type WorkspaceAction } from "@/lib/workspace/permissions";

export function usePermission(action: WorkspaceAction): boolean {
  const { role } = useWorkspace();
  return can(role, action);
}

type CanProps = {
  action: WorkspaceAction;
  children: ReactNode;
  fallback?: ReactNode;
};

export function Can({ action, children, fallback = null }: CanProps) {
  const allowed = usePermission(action);
  if (!allowed) return fallback;
  return children;
}
