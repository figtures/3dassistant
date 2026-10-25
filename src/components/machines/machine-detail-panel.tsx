"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMachine } from "@/hooks/use-data";
import { useMachineLiveSse } from "@/hooks/use-machine-sse";
import { MachineTempsPanel } from "@/components/machines/machine-temps-panel";
import { MachineCameraPanel } from "@/components/machines/machine-camera-panel";
import { MachineLiveStatus } from "@/components/machines/machine-live-status";
import { MachineTelemetryChart } from "@/components/machines/machine-telemetry-chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/skeleton";
import { VENDOR_LABELS, type PrinterVendor } from "@/lib/printer-cloud/types";
import { BRIDGE_VENDOR_LABELS, type BridgeVendor } from "@/lib/bridge/vendors";
import { ArrowLeft, Cloud, Radio, RefreshCw, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";
import { useState } from "react";
import type { TelemetrySnapshotRow } from "@/lib/printer-monitoring/telemetry-history";

export function MachineDetailPanel({ machineId }: { machineId: string }) {
  const router = useRouter();
  const { data: machine, isLoading, refetch } = useMachine(machineId, { live: true });
  const { live: sseMachine, sseConnected } = useMachineLiveSse(machineId);
  const [syncing, setSyncing] = useState(false);
  const display = sseMachine ? { ...machine!, ...sseMachine } : machine;

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

  if (isLoading || !machine || !display) {
    return isLoading ? <PageLoader /> : <p className="text-zinc-500">Makine bulunamadı.</p>;
  }

  const cloud = display.machine_cloud_link;
  const bridge = display.bridge_binding;
  const cloudVendor = cloud?.integration_account?.vendor as PrinterVendor | undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title={display.name}
        description={
          (display.model ?? "Canlı izleme") +
          (sseConnected ? " · SSE canlı" : "")
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/machines"
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-900/50 px-3 text-xs text-zinc-200 hover:bg-zinc-800/80"
            >
              <ArrowLeft className="h-4 w-4" /> Makineler
            </Link>
            <Button variant="secondary" size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Yenile
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-zinc-300">Canlı durum</h2>
          <div className="flex flex-wrap gap-2">
            {cloud?.enabled && cloudVendor && (
              <Badge variant="primary">
                <Cloud className="mr-1 h-3 w-3" />
                {VENDOR_LABELS[cloudVendor]}
              </Badge>
            )}
            {bridge?.id && (
              <Badge variant="primary">
                <Radio className="mr-1 h-3 w-3" />
                Köprü
                {bridge.vendor && BRIDGE_VENDOR_LABELS[bridge.vendor as BridgeVendor]
                  ? ` · ${BRIDGE_VENDOR_LABELS[bridge.vendor as BridgeVendor]}`
                  : ""}
              </Badge>
            )}
          </div>
          <MachineLiveStatus machine={display} detailed />
          <MachineTempsPanel machine={display} />
          {display.telemetry_updated_at && (
            <p className="text-xs text-zinc-600">
              Telemetri:{" "}
              {formatDistanceToNow(new Date(display.telemetry_updated_at), {
                addSuffix: true,
                locale: tr,
              })}
            </p>
          )}
        </section>

        <section className="glass rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">Bağlantı bilgisi</h2>
          {cloud?.enabled && (
            <dl className="space-y-2 text-sm text-zinc-400">
              <div>
                <dt className="text-zinc-500">Bulut cihaz</dt>
                <dd>{cloud.external_device_name ?? cloud.external_device_id}</dd>
              </div>
              {cloud.integration_account?.last_sync_at && (
                <div>
                  <dt className="text-zinc-500">Son bulut senkron</dt>
                  <dd>
                    {formatDistanceToNow(new Date(cloud.integration_account.last_sync_at), {
                      addSuffix: true,
                      locale: tr,
                    })}
                  </dd>
                </div>
              )}
            </dl>
          )}
          {bridge?.id && (
            <dl className="space-y-2 text-sm text-zinc-400">
              <div>
                <dt className="text-zinc-500">Yerel kimlik</dt>
                <dd className="font-mono text-xs">{bridge.device_serial}</dd>
              </div>
              {bridge.lan_host && (
                <div>
                  <dt className="text-zinc-500">Atölye IP (köprüde)</dt>
                  <dd className="font-mono text-xs">{bridge.lan_host}</dd>
                </div>
              )}
              {bridge.last_push_at && (
                <div>
                  <dt className="text-zinc-500">Son köprü push</dt>
                  <dd>
                    {formatDistanceToNow(new Date(bridge.last_push_at), {
                      addSuffix: true,
                      locale: tr,
                    })}
                  </dd>
                </div>
              )}
              {bridge.bridge?.last_seen_at && (
                <div>
                  <dt className="text-zinc-500">Köprü ajanı</dt>
                  <dd>
                    {bridge.bridge.label} —{" "}
                    {formatDistanceToNow(new Date(bridge.bridge.last_seen_at), {
                      addSuffix: true,
                      locale: tr,
                    })}
                  </dd>
                </div>
              )}
            </dl>
          )}
          {!cloud?.enabled && !bridge?.id && (
            <p className="text-sm text-zinc-500">
              Henüz bağlı değil.{" "}
              <button
                type="button"
                className="text-sky-400 hover:text-sky-300"
                onClick={() => router.push("/machines")}
              >
                Makineler sayfasından bağlayın
              </button>
            </p>
          )}
        </section>
      </div>

      <section className="glass rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-zinc-300">Kamera</h2>
        <MachineCameraPanel
          machineId={bridge?.id ? machineId : undefined}
          streamUrl={display.camera_stream_url}
        />
      </section>

      <section className="glass rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-zinc-300">İlerleme geçmişi (24 saat)</h2>
        <MachineTelemetryChart snapshots={history ?? []} loading={historyLoading} />
      </section>

      {display.error_message && (
        <section className="rounded-2xl border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-300">
          {display.error_message}
        </section>
      )}
    </div>
  );
}
