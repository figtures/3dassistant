import { WORKSPACE_ROLES, type WorkspaceRole } from "@/types/database";

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Sahip",
  admin: "Yönetici",
  operator: "Operatör",
  accountant: "Muhasebe",
  viewer: "İzleyici",
};

/** Davet ile atanabilir roller (sahip hariç). */
export const INVITABLE_WORKSPACE_ROLES = WORKSPACE_ROLES.filter(
  (r): r is Exclude<WorkspaceRole, "owner"> => r !== "owner"
);

export function isInvitableRole(role: string): role is Exclude<WorkspaceRole, "owner"> {
  return (INVITABLE_WORKSPACE_ROLES as readonly string[]).includes(role);
}
