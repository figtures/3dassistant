"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
} from "@/components/ds";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import { useConfirm } from "@/hooks/use-confirm";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { isWorkspaceAdminRole } from "@/lib/workspace/roles";
import { WORKSPACE_ROLE_LABELS } from "@/lib/workspace/role-labels";
import type { WorkspaceRole } from "@/types/database";
import { InviteSheet } from "@/features/team/invite-sheet";
import { MembersTable } from "@/features/team/members-table";
import { MailPlus, Users } from "lucide-react";
import {
  TEAM_INVITES_QUERY_KEY,
  TEAM_MEMBERS_QUERY_KEY,
  useTeamInvites,
  useTeamMembers,
} from "@/features/team/queries";

export function TeamScreen() {
  const { role, name: workspaceName } = useWorkspace();
  const canManage = isWorkspaceAdminRole(role);
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: membersData, isLoading: membersLoading, isError: membersError } = useTeamMembers();
  const { data: invitesData, isLoading: invitesLoading } = useTeamInvites();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const members = membersData?.members ?? [];
  const invites = invitesData?.invites ?? [];

  const memberSnapshots = useMemo(
    () => members.map((m) => ({ userId: m.userId, role: m.role as WorkspaceRole })),
    [members]
  );

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: TEAM_MEMBERS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: TEAM_INVITES_QUERY_KEY });
  }, [queryClient]);

  async function patchRole(userId: string, newRole: WorkspaceRole) {
    const res = await fetch(`/api/workspace/members/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast.error("Rol güncellenemedi", { description: data.error });
      return;
    }
    toast.success("Rol güncellendi");
    invalidate();
  }

  async function removeMember(userId: string) {
    const ok = await confirm({
      title: "Üyeyi çıkar",
      description: "Bu kişi çalışma alanına erişemeyecek. Devam edilsin mi?",
      confirmLabel: "Çıkar",
    });
    if (!ok) return;

    const res = await fetch(`/api/workspace/members/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast.error("Üye çıkarılamadı", { description: data.error });
      return;
    }
    toast.success("Üye çıkarıldı");
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
    invalidate();
  }

  async function cancelInvite(inviteId: string) {
    const res = await fetch("/api/workspace/invites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast.error("Davet iptal edilemedi", { description: data.error });
      return;
    }
    toast.success("Davet iptal edildi");
    invalidate();
  }

  async function bulkRemove() {
    const ids = [...selectedIds];
    if (!ids.length) return;

    const ok = await confirm({
      title: "Seçili üyeleri çıkar",
      description: `${ids.length} üye çıkarılacak. Onaylıyor musunuz?`,
      confirmLabel: "Çıkar",
    });
    if (!ok) return;

    let removed = 0;
    for (const userId of ids) {
      const res = await fetch(`/api/workspace/members/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        removed += 1;
      } else {
        toast.error("Bazı üyeler çıkarılamadı", { description: data.error });
        break;
      }
    }
    if (removed) {
      toast.success(`${removed} üye çıkarıldı`);
      setSelectedIds(new Set());
      invalidate();
    }
  }

  if (membersError) {
    return (
      <EmptyState
        icon={Users}
        title="Ekip yüklenemedi"
        description="Bağlantınızı kontrol edip tekrar deneyin."
        action={
          <Button type="button" onClick={() => router.refresh()}>
            Yenile
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <HelpTitleRow>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Ekip
            </h1>
          </HelpTitleRow>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {workspaceName} çalışma alanındaki üyeleri yönetin ve davet gönderin.
          </p>
        </div>
        {canManage ? (
          <Button type="button" onClick={() => setInviteOpen(true)}>
            <MailPlus className="size-4" aria-hidden />
            Davet gönder
          </Button>
        ) : null}
      </div>

      {membersLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <MembersTable
          members={members}
          actorRole={role}
          canManage={canManage}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          onRoleChange={patchRole}
          onRemove={removeMember}
          onBulkRemove={bulkRemove}
          allMembers={memberSnapshots}
        />
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Bekleyen davetler</h2>
        {invitesLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : invites.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Bekleyen davet yok.
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">E-posta</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Son tarih</th>
                  {canManage ? <th className="px-4 py-3 font-medium" /> : null}
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id} className="border-t border-border/60">
                    <td className="px-4 py-3">{inv.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone="neutral">
                        {WORKSPACE_ROLE_LABELS[inv.role as WorkspaceRole] ?? inv.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(inv.expires_at).toLocaleDateString("tr-TR")}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void cancelInvite(inv.id)}
                        >
                          İptal
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!canManage ? (
        <p className="text-sm text-muted-foreground">
          Üye ve davet yönetimi yalnızca sahip ve yönetici rollerinde kullanılabilir.{" "}
          <Link href="/dashboard" className="text-primary hover:underline">
            Panele dön
          </Link>
        </p>
      ) : null}

      <InviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSent={() => {
          invalidate();
          setInviteOpen(false);
        }}
      />
    </div>
  );
}
