import { NextResponse } from "next/server";
import type { WorkspaceRole } from "@/types/database";
import { can, type WorkspaceAction } from "@/lib/workspace/permissions";

export type AuthorizedWorkspaceSession = {
  ok: true;
  authUserId: string;
  workspaceId: string;
  role: WorkspaceRole;
};

const FORBIDDEN = NextResponse.json(
  { error: "Bu işlem için yetkiniz yok" },
  { status: 403 }
);

/** API route: oturum rolü eylem matrisine uygun mu? */
export function requireRole(
  session: AuthorizedWorkspaceSession,
  action: WorkspaceAction
): { ok: true } | { ok: false; response: NextResponse } {
  if (!can(session.role, action)) {
    return { ok: false, response: FORBIDDEN };
  }
  return { ok: true };
}
