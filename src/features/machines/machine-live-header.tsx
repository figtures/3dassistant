"use client";

import { Cloud, Radio } from "lucide-react";
import { Badge } from "@/components/ds";
import { LayerProgress } from "@/components/v2/layer-progress";
import { deriveMachineState } from "@/lib/machine-state";
import { VENDOR_LABELS, type PrinterVendor } from "@/lib/printer-cloud/types";
import { BRIDGE_VENDOR_LABELS, type BridgeVendor } from "@/lib/bridge/vendors";
import type { Machine, MachineConnectionStatus } from "@/types/database";
import { cn } from "@/lib/utils";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";

const CONNECTION_LABELS: Record<MachineConnectionStatus, string> = {
  connected: "Bağlı",
  disconnected: "Erişilemedi",
  error: "Bağlantı hatası",
  never: "Henüz senkron yok",
};

function formatPrintTime(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds < 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Props = {
  machine: Machine;
  sseConnected?: boolean;
  className?: string;
};

export function MachineLiveHeader({ machine, sseConnected, className }: Props) {
  const uiState = deriveMachineState(machine);
  const connectionStatus = machine.connection_status ?? "never";
  const cloud = machine.machine_cloud_link;
  const bridge = machine.bridge_binding;
  const cloudVendor = cloud?.integration_account?.vendor as PrinterVendor | undefined;
  const printing =
    machine.printer_state === "printing" && machine.progress_percent != null;
  const progress = printing ? Math.round(Number(machine.progress_percent)) : 0;

  return (
    <header
      className={cn("space-y-4", className)}
      data-testid="machine-detail-header"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <HelpTitleRow>
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {machine.name}
            </h1>
          </HelpTitleRow>
          {machine.model && (
            <p className="text-sm text-muted-foreground">{machine.model}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge machineState={uiState} />
          {cloud?.enabled && cloudVendor && (
            <Badge tone="primary">
              <Cloud className="mr-1 size-3" aria-hidden />
              {VENDOR_LABELS[cloudVendor]}
            </Badge>
          )}
          {bridge?.id && (
            <Badge tone="steel">
              <Radio className="mr-1 size-3" aria-hidden />
              Köprü
              {bridge.vendor && BRIDGE_VENDOR_LABELS[bridge.vendor as BridgeVendor]
                ? ` · ${BRIDGE_VENDOR_LABELS[bridge.vendor as BridgeVendor]}`
                : ""}
            </Badge>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Bağlantı:{" "}
        <span className="text-foreground">
          {CONNECTION_LABELS[connectionStatus] ?? CONNECTION_LABELS.never}
        </span>
        {sseConnected ? (
          <>
            {" "}
            ·{" "}
            <span className="text-foreground" data-live="sse">
              Canlı akış açık
            </span>
          </>
        ) : null}
      </p>

      {printing && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-medium text-foreground">
              {machine.job_name ?? "Baskı"}
            </span>
            <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
              {progress}%
            </span>
          </div>
          <LayerProgress percent={progress} />
          {machine.print_time_seconds != null && (
            <p className="text-xs text-muted-foreground">
              Geçen süre:{" "}
              <span className="font-mono tabular-nums text-foreground">
                {formatPrintTime(machine.print_time_seconds)}
              </span>
            </p>
          )}
        </div>
      )}

      {!printing && machine.job_name && (
        <p className="text-sm text-muted-foreground">
          Son iş:{" "}
          <span className="text-foreground">{machine.job_name}</span>
        </p>
      )}
    </header>
  );
}
