import { useQuery } from "@tanstack/react-query";
import { useTenantId } from "@/components/workspace/workspace-provider";
import type { WorkspaceInvite } from "@/types/database";

export const TEAM_MEMBERS_QUERY_KEY = ["workspace", "members"] as const;
export const TEAM_INVITES_QUERY_KEY = ["workspace", "invites"] as const;

export type TeamMemberRow = {
  userId: string;
  role: string;
  createdAt: string;
  email: string | null;
  fullName: string | null;
};

async function fetchMembers(): Promise<{
  members: TeamMemberRow[];
  canManage: boolean;
}> {
  const res = await fetch("/api/workspace/members");
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    members?: TeamMemberRow[];
    canManage?: boolean;
  };
  if (!res.ok) {
    throw new Error(data.error ?? "Üyeler yüklenemedi");
  }
  return { members: data.members ?? [], canManage: Boolean(data.canManage) };
}

async function fetchInvites(): Promise<{ invites: WorkspaceInvite[]; canManage: boolean }> {
  const res = await fetch("/api/workspace/invites");
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    invites?: WorkspaceInvite[];
    canManage?: boolean;
  };
  if (!res.ok) {
    throw new Error(data.error ?? "Davetler yüklenemedi");
  }
  return { invites: data.invites ?? [], canManage: Boolean(data.canManage) };
}

export function useTeamMembers() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...TEAM_MEMBERS_QUERY_KEY, tenantId],
    queryFn: fetchMembers,
  });
}

export function useTeamInvites() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...TEAM_INVITES_QUERY_KEY, tenantId],
    queryFn: fetchInvites,
  });
}
