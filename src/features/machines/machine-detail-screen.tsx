"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useMachine } from "@/hooks/use-data";
import { useMachineLiveSse } from "@/hooks/use-machine-sse";
import { useBreadcrumbLabel } from "@/hooks/use-breadcrumb-label";
import { Button, Skeleton } from "@/components/ds";
import { buttonVariants } from "@/components/ds/variants";
import { cn } from "@/lib/utils";
import { MachineLiveHeader } from "@/features/machines/machine-live-header";
import { MachineTabs } from "@/features/machines/machine-tabs";
import type { TelemetrySnapshotRow } from "@/lib/printer-monitoring/telemetry-history";
import { toast } from "sonner";

export function MachineDetailScreen({ machineId }: { machineId: string }) {
  const { data: machine, isLoading, refetch } = useMachine(machineId, { live: true });
  const { live: sseMachine, sseConnected } = useMachineLiveSse(machineId);
  const [syncing, setSyncing] = useState(false);
  const display = sseMachine && machine ? { ...machine, ...sseMachine } : machine;

  useBreadcrumbLabel(machineId, display?.name);

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["machine-telemetry-history", machineId],
    queryFn: async () => {
      const res = await fetch(`/api/machines/${machineId}/telemetry-history?hours=24`);
      if (!res.ok) throw new Error("Geçmiş alınamadı");
      const body = await res.json();
      return body.snapshots as TelemetrySnapshotRow[];
    },
    refetchInterval: 30_000,
    enabled: Boolean(machineId),
  });

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/machines/${machineId}/sync`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.fromBridge) {
        toast.info(data.message ?? "Köprü otomatik günceller");
      } else if (!res.ok) {
        toast.error(data.error ?? "Güncellenemedi");
      } else {
        toast.success("Durum güncellendi");
      }
      await refetch();
    } catch {
      toast.error("Ağ hatası");
    } finally {
      setSyncing(false);
    }
  }

  if (isLoading || !display) {
    return (
      <div
        className="mx-auto w-full max-w-6xl space-y-6 pb-8"
        data-testid="machine-detail-v2-loading"
      >
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Makine bulunamadı.</p>
        )}
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-6xl space-y-6 pb-8"
      data-testid="machine-detail-v2"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/machines"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Makineler
        </Link>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          loading={syncing}
        >
          <RefreshCw className="size-4" aria-hidden />
          Yenile
        </Button>
      </div>

      <MachineLiveHeader machine={display} sseConnected={sseConnected} />

      <MachineTabs
        machine={display}
        machineId={machineId}
        history={history}
        historyLoading={historyLoading}
      />
    </div>
  );
}
