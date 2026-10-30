import { cache } from "react";
import { cookies } from "next/headers";
import type { WorkspaceRole } from "@/types/database";
import { getAuthUser } from "@/lib/supabase/get-auth-user";
import { createClient } from "@/lib/supabase/server";

export const WORKSPACE_COOKIE = "pf_ws";
export const WORKSPACE_COOKIE_MAX_AGE = 31536000;

export type WorkspaceMembershipPick = {
  workspaceId: string;
  name: string;
  role: WorkspaceRole;
};

export type WorkspaceSession = {
  id: string;
  name: string;
  role: WorkspaceRole;
  memberships: Array<{ id: string; name: string; role: WorkspaceRole }>;
};

/** Cookie + üyelik listesinden aktif workspace uuid'sini seçer (saf, test edilebilir). */
export function resolveActiveWorkspaceId(
  authUserId: string,
  cookieWorkspaceId: string | undefined | null,
  memberships: WorkspaceMembershipPick[]
): string {
  if (memberships.length === 0) {
    return authUserId;
  }

  if (cookieWorkspaceId) {
    const fromCookie = memberships.find((m) => m.workspaceId === cookieWorkspaceId);
    if (fromCookie) return fromCookie.workspaceId;
  }

  const owned = memberships.find((m) => m.workspaceId === authUserId);
  if (owned) return owned.workspaceId;

  return memberships[0]!.workspaceId;
}

const FALLBACK_NAME = "Atölyem";

function fallbackSession(authUserId: string): WorkspaceSession {
  const row = { id: authUserId, name: FALLBACK_NAME, role: "owner" as const };
  return { ...row, memberships: [row] };
}

export const loadWorkspaceSession = cache(async (): Promise<WorkspaceSession | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const jar = await cookies();
  const cookieId = jar.get(WORKSPACE_COOKIE)?.value ?? null;

  const { data: rows, error } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces(id, name)")
    .eq("user_id", user.id);

  if (error) {
    console.error("[workspace] üyelik yüklenemedi", error.message);
    return fallbackSession(user.id);
  }

  const memberships = (rows ?? [])
    .map((row) => {
      const wsRaw = row.workspace as { id: string; name: string } | { id: string; name: string }[] | null;
      const ws = Array.isArray(wsRaw) ? wsRaw[0] : wsRaw;
      return {
        id: ws?.id ?? user.id,
        name: ws?.name?.trim() || FALLBACK_NAME,
        role: row.role as WorkspaceRole,
      };
    })
    .filter((m) => m.id);

  if (memberships.length === 0) {
    return fallbackSession(user.id);
  }

  const activeId = resolveActiveWorkspaceId(
    user.id,
    cookieId,
    memberships.map((m) => ({
      workspaceId: m.id,
      name: m.name,
      role: m.role,
    }))
  );

  const active = memberships.find((m) => m.id === activeId) ?? memberships[0]!;

  return {
    id: active.id,
    name: active.name,
    role: active.role,
    memberships,
  };
});

/** Sunucu: aktif workspace id (kiracı; `user_id` sütunu). */
export async function getActiveWorkspaceId(): Promise<string | null> {
  const session = await loadWorkspaceSession();
  return session?.id ?? null;
}

/** Sunucu: oturum + aktif workspace (API route'ları). */
export async function requireWorkspaceSession(): Promise<
  | { ok: true; authUserId: string; workspaceId: string; role: WorkspaceRole }
  | { ok: false; status: 401 }
> {
  const user = await getAuthUser();
  if (!user) return { ok: false, status: 401 };
  const session = await loadWorkspaceSession();
  if (!session) return { ok: false, status: 401 };
  return {
    ok: true,
    authUserId: user.id,
    workspaceId: session.id,
    role: session.role,
  };
}
