"use client";

import { useMemo } from "react";
import { Badge, Button } from "@/components/ds";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import {
  bulkRemoveRejectReasons,
  canRemoveMember,
  type MemberSnapshot,
} from "@/lib/workspace/member-rules";
import {
  INVITABLE_WORKSPACE_ROLES,
  WORKSPACE_ROLE_LABELS,
} from "@/lib/workspace/role-labels";
import type { WorkspaceRole } from "@/types/database";
import type { TeamMemberRow } from "@/features/team/queries";
import { Trash2 } from "lucide-react";

const selectClassName =
  "h-8 rounded-md border border-input bg-surface-inset px-2 text-xs text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

export type MembersTableProps = {
  members: TeamMemberRow[];
  actorRole: WorkspaceRole;
  canManage: boolean;
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
  allMembers: MemberSnapshot[];
  onRoleChange: (userId: string, role: WorkspaceRole) => void;
  onRemove: (userId: string) => void;
  onBulkRemove: () => void;
};

function displayName(row: TeamMemberRow): string {
  return row.fullName?.trim() || row.email?.trim() || row.userId.slice(0, 8);
}

export function MembersTable({
  members,
  actorRole,
  canManage,
  selectedIds,
  onSelectedIdsChange,
  allMembers,
  onRoleChange,
  onRemove,
  onBulkRemove,
}: MembersTableProps) {
  const { id: actorUserId } = useWorkspace();

  const selectableIds = useMemo(() => {
    if (!canManage) return new Set<string>();
    const rejected = bulkRemoveRejectReasons(
      actorUserId,
      actorRole,
      members.map((m) => ({ userId: m.userId, role: m.role as WorkspaceRole })),
      allMembers
    );
    return new Set(members.filter((m) => !rejected.has(m.userId)).map((m) => m.userId));
  }, [actorRole, actorUserId, allMembers, canManage, members]);

  const rejectReasons = useMemo(
    () =>
      bulkRemoveRejectReasons(
        actorUserId,
        actorRole,
        members.map((m) => ({ userId: m.userId, role: m.role as WorkspaceRole })),
        allMembers
      ),
    [actorRole, actorUserId, allMembers, members]
  );

  function toggleOne(userId: string) {
    onSelectedIdsChange(
      (() => {
        const next = new Set(selectedIds);
        if (next.has(userId)) next.delete(userId);
        else next.add(userId);
        return next;
      })()
    );
  }

  function toggleAll() {
    if (selectedIds.size === selectableIds.size) {
      onSelectedIdsChange(new Set());
      return;
    }
    onSelectedIdsChange(new Set(selectableIds));
  }

  const selectedCount = [...selectedIds].filter((id) => selectableIds.has(id)).length;

  return (
    <div className="space-y-3">
      {canManage && selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
          <span>{selectedCount} seçili</span>
          <Button type="button" size="sm" variant="danger" onClick={onBulkRemove}>
            Seçilenleri çıkar
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 z-[1] bg-surface-2 text-left text-muted-foreground">
              <tr className="border-b border-border">
                {canManage ? (
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input"
                      checked={selectableIds.size > 0 && selectedIds.size === selectableIds.size}
                      onChange={toggleAll}
                      aria-label="Tümünü seç"
                    />
                  </th>
                ) : null}
                {["Kişi", "E-posta", "Rol", ""].map((h) => (
                  <th key={h || "actions"} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const role = m.role as WorkspaceRole;
                const snapshot = { userId: m.userId, role };
                const removeCheck = canRemoveMember(actorUserId, actorRole, snapshot, allMembers);
                const rejectReason = rejectReasons.get(m.userId);
                const canSelect = canManage && !rejectReason;

                return (
                  <tr
                    key={m.userId}
                    className="border-b border-border/60 transition-colors hover:bg-surface-2/50"
                    title={rejectReason ?? undefined}
                  >
                    {canManage ? (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-input disabled:opacity-40"
                          checked={selectedIds.has(m.userId)}
                          disabled={!canSelect}
                          onChange={() => toggleOne(m.userId)}
                          aria-label={`${displayName(m)} seç`}
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-3 font-medium text-foreground">{displayName(m)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      {canManage && role !== "owner" ? (
                        <select
                          className={selectClassName}
                          value={role}
                          onChange={(e) =>
                            onRoleChange(m.userId, e.target.value as WorkspaceRole)
                          }
                          aria-label={`${displayName(m)} rolü`}
                        >
                          {INVITABLE_WORKSPACE_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {WORKSPACE_ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge tone={role === "owner" ? "primary" : "neutral"}>
                          {WORKSPACE_ROLE_LABELS[role] ?? role}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {canManage ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!removeCheck.ok}
                            title={removeCheck.ok ? "Çıkar" : removeCheck.reason}
                            onClick={() => onRemove(m.userId)}
                          >
                            <Trash2 className="size-4" aria-hidden />
                            <span className="sr-only">Çıkar</span>
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {canManage && rejectReasons.size > 0 ? (
        <p className="text-xs text-muted-foreground">
          Bazı satırlar seçilemez: sahip veya son sahip kuralları geçerlidir.
        </p>
      ) : null}
    </div>
  );
}
