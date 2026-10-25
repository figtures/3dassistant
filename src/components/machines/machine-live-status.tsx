"use client";

import { Badge } from "@/components/ui/badge";
import type {
  Machine,
  MachineConnectionStatus,
  MachinePrinterState,
} from "@/types/database";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

const PRINTER_LABELS: Record<MachinePrinterState, string> = {
  printing: "Çalışıyor",
  paused: "Duraklatıldı",
  idle: "Boşta",
  error: "Hata",
  offline: "Bağlı değil",
  unknown: "Bilinmiyor",
};

const PRINTER_VARIANT: Record<
  MachinePrinterState,
  "success" | "warning" | "danger" | "default"
> = {
  printing: "success",
  paused: "warning",
  idle: "default",
  error: "danger",
  offline: "danger",
  unknown: "default",
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
  /** Detay sayfası: daha fazla meta */
  detailed?: boolean;
  /** Dashboard kartı: tek satır özet */
  compact?: boolean;
};

export function MachineLiveStatus({ machine, detailed, compact }: Props) {
  const conn = machine.machine_connection;
  const cloudLinked = Boolean(machine.machine_cloud_link?.enabled);
  const bridgeLinked = Boolean(machine.bridge_binding?.id);
  const printerState = machine.printer_state ?? "unknown";
  const connectionStatus = machine.connection_status ?? "never";

  if (!conn && !cloudLinked && !bridgeLinked) {
    if (compact) return <p className="text-xs text-zinc-500">Canlı takip yok</p>;
    return (
      <p className="text-xs text-zinc-500">
        Canlı takip yok — <span className="text-zinc-400">Yazıcıları bağla</span> veya{" "}
        <span className="text-zinc-400">Atölye köprüsü</span> kurun.
      </p>
    );
  }

  if (!cloudLinked && conn?.adapter_type === "manual") {
    return (
      <div className="space-y-2">
        <Badge variant="default">Manuel / izleme yok</Badge>
        {detailed && machine.status !== "active" && (
          <p className="text-xs text-zinc-500">Planlama durumu: {machine.status}</p>
        )}
      </div>
    );
  }

  if (compact) {
    const pct =
      printerState === "printing" && machine.progress_percent != null
        ? ` · ${Math.round(Number(machine.progress_percent))}%`
        : "";
    return (
      <p className="text-xs text-zinc-500 truncate">
        {PRINTER_LABELS[printerState]}
        {pct}
        {machine.job_name ? ` · ${machine.job_name}` : ""}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant={PRINTER_VARIANT[printerState]}>
          {PRINTER_LABELS[printerState]}
        </Badge>
        <ConnectionBadge status={connectionStatus} />
      </div>

      {printerState === "printing" && machine.progress_percent != null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-zinc-400">
            <span className="truncate pr-2">{machine.job_name ?? "Baskı"}</span>
            <span>{Math.round(Number(machine.progress_percent))}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(100, Number(machine.progress_percent))}%` }}
            />
          </div>
        </div>
      )}

      {machine.job_name && printerState !== "printing" && (
        <p className="text-xs text-zinc-500 truncate">Son iş: {machine.job_name}</p>
      )}

      {machine.print_time_seconds != null && printerState === "printing" && (
        <p className="text-xs text-zinc-500">
          Süre: {formatPrintTime(machine.print_time_seconds)}
        </p>
      )}

      {detailed &&
        (machine.bed_temp_c != null || machine.nozzle_temp_c != null) && (
          <p className="text-xs text-zinc-500">
            Tabla {Math.round(machine.bed_temp_c ?? 0)}°C · Nozzle{" "}
            {Math.round(machine.nozzle_temp_c ?? 0)}°C
            {machine.chamber_temp_c != null
              ? ` · Oda ${Math.round(machine.chamber_temp_c)}°C`
              : ""}
          </p>
        )}

      {detailed && bridgeLinked && machine.bridge_binding?.last_push_at && (
        <p className="text-xs text-zinc-600">
          Köprü push:{" "}
          {formatDistanceToNow(new Date(machine.bridge_binding.last_push_at), {
            addSuffix: true,
            locale: tr,
          })}
        </p>
      )}

      {machine.error_message && (
        <p className="text-xs text-red-400/90 line-clamp-2">{machine.error_message}</p>
      )}

      {(machine.last_seen_at || machine.telemetry_updated_at) && (
        <p className="text-xs text-zinc-600">
          Son görülme:{" "}
          {formatDistanceToNow(
            new Date(machine.telemetry_updated_at ?? machine.last_seen_at!),
            { addSuffix: true, locale: tr }
          )}
        </p>
      )}
    </div>
  );
}

function ConnectionBadge({ status }: { status: MachineConnectionStatus }) {
  const map: Record<
    MachineConnectionStatus,
    { label: string; variant: "success" | "warning" | "danger" | "default" }
  > = {
    connected: { label: "Bağlı", variant: "success" },
    disconnected: { label: "Erişilemedi", variant: "warning" },
    error: { label: "Bağlantı hatası", variant: "danger" },
    never: { label: "Henüz senkron yok", variant: "default" },
  };
  const { label, variant } = map[status] ?? map.never;
  return (
    <Badge variant={variant} className="text-[10px]">
      {label}
    </Badge>
  );
}
