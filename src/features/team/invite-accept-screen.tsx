"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Card, CardContent, Skeleton } from "@/components/ds";
import { AuthShell } from "@/features/auth/auth-shell";
import { WORKSPACE_ROLE_LABELS } from "@/lib/workspace/role-labels";
import type { WorkspaceRole } from "@/types/database";

type InvitePreview = {
  email: string;
  role: string;
  expiresAt: string;
  workspaceName: string;
};

export function InviteAcceptScreen({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch(
        `/api/workspace/invites/accept?token=${encodeURIComponent(token)}`
      );
      const data = (await res.json().catch(() => ({}))) as InvitePreview & { error?: string };
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? "Davet yüklenemedi");
        setPreview(null);
      } else {
        setPreview(data);
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    setAccepting(true);
    const res = await fetch("/api/workspace/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      workspaceId?: string;
    };
    setAccepting(false);

    if (res.status === 401) {
      router.push(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
      return;
    }

    if (!res.ok) {
      toast.error("Davet kabul edilemedi", { description: data.error });
      setError(data.error ?? "Davet kabul edilemedi");
      return;
    }

    toast.success("Çalışma alanına katıldınız!");
    await fetch("/api/workspace/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: data.workspaceId }),
    }).catch(() => undefined);
    router.replace("/dashboard");
    router.refresh();
  }

  if (loading) {
    return (
      <AuthShell title="Davet" description="Yükleniyor…">
        <Skeleton className="h-32 w-full rounded-xl" />
      </AuthShell>
    );
  }

  if (error || !preview) {
    return (
      <AuthShell title="Davet geçersiz" description={error ?? "Bağlantı geçersiz veya süresi dolmuş."}>
        <Link
          href="/login"
          className="inline-flex h-[var(--density-control-h)] w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Giriş yap
        </Link>
      </AuthShell>
    );
  }

  const roleLabel =
    WORKSPACE_ROLE_LABELS[preview.role as WorkspaceRole] ?? preview.role;

  return (
    <AuthShell
      title={`${preview.workspaceName} daveti`}
      description={`${preview.email} adresine gönderilen daveti kabul edin.`}
    >
      <Card>
        <CardContent className="space-y-4 py-6">
          <p className="text-sm text-muted-foreground">
            Rol: <strong className="text-foreground">{roleLabel}</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Son geçerlilik: {new Date(preview.expiresAt).toLocaleString("tr-TR")}
          </p>
          <Button type="button" className="w-full" size="lg" loading={accepting} onClick={() => void accept()}>
            Daveti kabul et
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Hesabınız yok mu?{" "}
            <Link
              href={`/register?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="text-primary hover:underline"
            >
              Kayıt olun
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
