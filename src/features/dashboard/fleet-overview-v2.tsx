"use client";

import Link from "next/link";
import { useMachines } from "@/hooks/use-data";
import { useFleetLiveSse } from "@/hooks/use-machine-sse";
import { MachineLiveStatus } from "@/components/machines/machine-live-status";
import { summarizeFleet } from "@/lib/machine-state";
import type { MachinePrinterState } from "@/types/database";
import { ChevronRight, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

const STATE_ORDER: Record<MachinePrinterState, number> = {
  printing: 0,
  paused: 1,
  error: 2,
  idle: 3,
  offline: 4,
  unknown: 5,
};

const STATE_LABELS: Record<string, string> = {
  printing: "Baskıda",
  paused: "Duraklatıldı",
  idle: "Boşta",
  error: "Hata",
  offline: "Çevrimdışı",
  maintenance: "Bakım",
  untracked: "İzlenmiyor",
  unknown: "Bilinmiyor",
};

function FleetOverviewSkeleton() {
  return (
    <div
      className="rounded-xl border border-border bg-card p-5 motion-reduce:animate-none animate-pulse"
      aria-busy="true"
    >
      <div className="h-5 w-40 rounded bg-muted" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-muted/60" />
        ))}
      </div>
    </div>
  );
}

export function FleetOverviewV2() {
  const { data: machines = [], isLoading, isError, refetch } = useMachines({
    live: true,
  });
  const fleetLive = useFleetLiveSse(true);

  if (isLoading) return <FleetOverviewSkeleton />;

  if (isError) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          Filo verisi yüklenemedi.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 text-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  const merged = machines.map((m) => {
    const live = fleetLive.find((f) => f.id === m.id);
    return live ? { ...m, ...live } : m;
  });

  const monitored = merged.filter(
    (m) =>
      m.bridge_binding?.id ||
      m.machine_cloud_link?.enabled ||
      (m.machine_connection && m.machine_connection.adapter_type !== "manual")
  );

  const summary = summarizeFleet(monitored);

  const sorted = [...monitored].sort(
    (a, b) =>
      (STATE_ORDER[a.printer_state ?? "unknown"] ?? 9) -
      (STATE_ORDER[b.printer_state ?? "unknown"] ?? 9)
  );

  const counters = (
    ["printing", "idle", "error", "offline"] as const
  ).filter((k) => summary[k] > 0);

  return (
    <section
      className="rounded-xl border border-border bg-card"
      aria-labelledby="fleet-overview-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
            <Cpu className="size-4" aria-hidden />
          </div>
          <div>
            <h2
              id="fleet-overview-heading"
              className="text-base font-semibold text-foreground"
            >
              Atölye özeti
            </h2>
            <p className="text-xs text-muted-foreground">
              {monitored.length > 0
                ? `${summary.printing} baskıda · ${monitored.length} izlenen makine`
                : "Canlı izlenen makine yok"}
            </p>
          </div>
        </div>
        <Link
          href="/machines"
          className="text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          Tüm makineler
        </Link>
      </div>

      {counters.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 pt-3">
          {counters.map((key) => (
            <span
              key={key}
              className={cn(
                "rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs tabular-nums text-muted-foreground",
                key === "printing" && "border-[var(--state-printing)]/30 text-[var(--state-printing)]",
                key === "error" && "border-[var(--state-error)]/30 text-[var(--state-error)]"
              )}
            >
              {summary[key]} {STATE_LABELS[key] ?? key}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-2 p-5 pt-3">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Canlı makine yok.{" "}
            <Link
              href="/machines"
              className="font-medium text-primary hover:text-primary-hover"
            >
              Yazıcı bağla veya köprü kur
            </Link>
          </p>
        ) : (
          sorted.slice(0, 6).map((m) => (
            <Link
              key={m.id}
              href={`/machines/${m.id}`}
              data-live
              className={cn(
                "flex items-start gap-3 rounded-lg border border-border bg-surface-2/50 p-3 transition-colors",
                "hover:border-border-strong hover:bg-surface-2",
                "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{m.name}</p>
                <MachineLiveStatus machine={m} compact />
              </div>
              <ChevronRight
                className="mt-1 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
