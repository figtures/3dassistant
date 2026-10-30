import { WORKSPACE_ROLES, type WorkspaceRole } from "@/types/database";

export { WORKSPACE_ROLES, type WorkspaceRole };

/** owner ve admin workspace yönetimi yapabilir (RLS ile uyumlu). */
export function isWorkspaceAdminRole(role: WorkspaceRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}
