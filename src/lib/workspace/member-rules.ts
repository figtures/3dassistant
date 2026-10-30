import type { WorkspaceRole } from "@/types/database";
import { isWorkspaceAdminRole } from "@/lib/workspace/roles";
import { isInvitableRole } from "@/lib/workspace/role-labels";

export type MemberSnapshot = {
  userId: string;
  role: WorkspaceRole;
};

export type RuleResult = { ok: true } | { ok: false; reason: string };

function fail(reason: string): RuleResult {
  return { ok: false, reason };
}

export function countOwners(members: MemberSnapshot[]): number {
  return members.filter((m) => m.role === "owner").length;
}

export function canUpdateMemberRole(
  actorRole: WorkspaceRole,
  target: MemberSnapshot,
  newRole: WorkspaceRole
): RuleResult {
  if (!isWorkspaceAdminRole(actorRole)) {
    return fail("Bu işlem için yönetici veya sahip yetkisi gerekir");
  }
  if (target.role === "owner") {
    return fail("Sahibin rolü değiştirilemez");
  }
  if (newRole === "owner") {
    return fail("Sahip rolü atanamaz");
  }
  if (target.role === newRole) {
    return fail("Rol zaten aynı");
  }
  return { ok: true };
}

export function canRemoveMember(
  actorUserId: string,
  actorRole: WorkspaceRole,
  target: MemberSnapshot,
  allMembers: MemberSnapshot[]
): RuleResult {
  if (!isWorkspaceAdminRole(actorRole)) {
    return fail("Bu işlem için yönetici veya sahip yetkisi gerekir");
  }
  if (target.role === "owner") {
    if (target.userId !== actorUserId) {
      return fail("Sahip çıkarılamaz");
    }
    if (countOwners(allMembers) <= 1) {
      return fail("Son sahip çalışma alanından ayrılamaz");
    }
  }
  if (target.userId === actorUserId && actorRole === "owner" && countOwners(allMembers) <= 1) {
    return fail("Son sahip çalışma alanından ayrılamaz");
  }
  return { ok: true };
}

export function canInviteWithRole(role: WorkspaceRole): RuleResult {
  if (!isInvitableRole(role)) {
    return fail("Geçersiz davet rolü");
  }
  return { ok: true };
}

export function inviteExpiryError(expiresAt: string, now = Date.now()): RuleResult {
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(expires)) {
    return fail("Davet geçersiz");
  }
  if (expires <= now) {
    return fail("Davetin süresi dolmuş. Yöneticiden yeni davet isteyin.");
  }
  return { ok: true };
}

export function inviteEmailMatchError(
  inviteEmail: string,
  userEmail: string | null | undefined
): RuleResult {
  const invited = inviteEmail.trim().toLowerCase();
  const user = userEmail?.trim().toLowerCase();
  if (!user) {
    return fail("Hesabınızda e-posta adresi yok");
  }
  if (invited !== user) {
    return fail("Bu davet farklı bir e-posta adresine gönderilmiş. Doğru hesapla giriş yapın.");
  }
  return { ok: true };
}

/** Toplu eylem: reddedilen satırların nedenleri (21st members-table mantığı). */
export function bulkRemoveRejectReasons(
  actorUserId: string,
  actorRole: WorkspaceRole,
  targets: MemberSnapshot[],
  allMembers: MemberSnapshot[]
): Map<string, string> {
  const rejected = new Map<string, string>();
  for (const target of targets) {
    const check = canRemoveMember(actorUserId, actorRole, target, allMembers);
    if (!check.ok) {
      rejected.set(target.userId, check.reason);
    }
  }
  return rejected;
}
