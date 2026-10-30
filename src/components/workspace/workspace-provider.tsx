"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceRole } from "@/types/database";
import type { WorkspaceSession } from "@/lib/workspace/active";

export type WorkspaceMembershipSummary = WorkspaceSession["memberships"][number];

export type WorkspaceContextValue = {
  id: string;
  name: string;
  role: WorkspaceRole;
  memberships: WorkspaceMembershipSummary[];
  switchWorkspace: (workspaceId: string) => Promise<void>;
  switching: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  initial,
  children,
}: {
  initial: WorkspaceSession;
  children: ReactNode;
}) {
  const router = useRouter();
  const [session, setSession] = useState(initial);
  const [switching, startTransition] = useTransition();

  const switchWorkspace = useCallback(
    async (workspaceId: string) => {
      if (workspaceId === session.id) return;

      const res = await fetch("/api/workspace/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Çalışma alanı değiştirilemedi");
      }

      const next = session.memberships.find((m) => m.id === workspaceId);
      if (next) {
        setSession((prev) => ({
          ...prev,
          id: next.id,
          name: next.name,
          role: next.role,
        }));
      }

      startTransition(() => {
        router.refresh();
      });
    },
    [router, session.id, session.memberships]
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      id: session.id,
      name: session.name,
      role: session.role,
      memberships: session.memberships,
      switchWorkspace,
      switching,
    }),
    [session, switchWorkspace, switching]
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace yalnızca WorkspaceProvider içinde kullanılabilir");
  }
  return ctx;
}

/** Kiracı kimliği — veritabanındaki `user_id` sütunu (workspace sahibinin uuid'si). */
export function useTenantId(): string {
  return useWorkspace().id;
}

export function useOptionalWorkspace(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}
