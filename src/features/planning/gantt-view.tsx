"use client";

import { useMemo } from "react";
import type { Job, Machine } from "@/types/database";
import { deriveMachineState, type UiMachineState } from "@/lib/machine-state";
import {
  cellBorderColor,
  cellFillColor,
  readableTextColor,
} from "@/lib/color-contrast";
import { formatDate, isWeekendDate, todayIsoInIstanbul } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  buildGanttColumns,
  formatJobRangeLabel,
  GANTT_COLUMN_WIDTH,
  jobIntersectsTimeline,
  jobTimeRange,
  layoutBarOnTimeline,
  timelineBounds,
  todayMarkerPercent,
  type GanttZoom,
} from "@/features/planning/gantt-layout";

const STATUS_FALLBACK_CLASS: Record<string, string> = {
  pending: "border-warning/40 bg-warning-subtle text-foreground",
  in_progress: "border-info/40 bg-info-subtle text-foreground",
  completed: "border-success/40 bg-success-subtle text-foreground",
  cancelled: "border-destructive/40 bg-destructive-subtle text-foreground",
};

function MachineStateDot({ state }: { state: UiMachineState }) {
  const colorClass: Record<UiMachineState, string> = {
    printing: "bg-state-printing pf-pulse-dot",
    paused: "bg-state-paused",
    idle: "bg-state-idle",
    error: "bg-state-error",
    offline: "bg-state-offline",
    maintenance: "bg-state-maintenance",
    untracked: "bg-state-unknown",
    unknown: "bg-state-unknown",
  };

  return (
    <span
      className={cn("size-2 shrink-0 rounded-full", colorClass[state])}
      aria-hidden
    />
  );
}

function GanttJobBar({
  job,
  layout,
  onOpen,
}: {
  job: Job;
  layout: { leftPercent: number; widthPercent: number };
  onOpen: () => void;
}) {
  const title = job.title ?? job.customer?.name ?? "Sipariş";
  const baseHex = job.cell_color?.trim();
  const useCustom = Boolean(baseHex && /^#?[0-9a-fA-F]{3,8}$/.test(baseHex));
  const hex = useCustom
    ? baseHex!.startsWith("#")
      ? baseHex!
      : `#${baseHex}`
    : null;

  const style = useCustom
    ? {
        left: `${layout.leftPercent}%`,
        width: `${layout.widthPercent}%`,
        backgroundColor: cellFillColor(hex!),
        borderColor: cellBorderColor(hex!),
        color: readableTextColor(hex!),
      }
    : {
        left: `${layout.leftPercent}%`,
        width: `${layout.widthPercent}%`,
      };

  return (
    <button
      type="button"
      onClick={onOpen}
      style={style}
      className={cn(
        "absolute top-1.5 z-[1] flex h-8 min-w-[2rem] items-center overflow-hidden rounded-md border px-2 text-left text-xs font-medium",
        "truncate focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
        !useCustom && (STATUS_FALLBACK_CLASS[job.status] ?? STATUS_FALLBACK_CLASS.pending)
      )}
      title={`${title} · ${formatJobRangeLabel(job.job_date, job.duration_minutes)}`}
      aria-label={`${title}, ${formatJobRangeLabel(job.job_date, job.duration_minutes)}`}
    >
      <span className="truncate">{title}</span>
    </button>
  );
}

export type GanttViewProps = {
  machines: Machine[];
  jobs: Job[];
  dates: string[];
  zoom: GanttZoom;
  onJobOpen: (job: Job) => void;
};

export function GanttView({
  machines,
  jobs,
  dates,
  zoom,
  onJobOpen,
}: GanttViewProps) {
  const today = todayIsoInIstanbul();
  const columns = useMemo(
    () => buildGanttColumns(zoom, dates, today),
    [zoom, dates, today]
  );
  const bounds = useMemo(() => timelineBounds(columns), [columns]);
  const colWidth = GANTT_COLUMN_WIDTH[zoom];
  const timelineWidth = columns.length * colWidth;

  const jobsByMachine = useMemo(() => {
    const map = new Map<string, Job[]>();
    if (!bounds) return map;
    for (const job of jobs) {
      if (
        !jobIntersectsTimeline(
          job.job_date,
          job.duration_minutes,
          bounds.startMs,
          bounds.endMs
        )
      ) {
        continue;
      }
      const list = map.get(job.machine_id) ?? [];
      list.push(job);
      map.set(job.machine_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.job_date.localeCompare(b.job_date));
    }
    return map;
  }, [jobs, bounds]);

  const todayPercent =
    bounds != null
      ? todayMarkerPercent(today, bounds.startMs, bounds.endMs)
      : null;

  if (!bounds || columns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Görüntülenecek tarih aralığı yok.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-card shadow-e0 [-webkit-overflow-scrolling:touch]"
        role="region"
        aria-label="Gantt üretim zaman çizelgesi"
      >
        <p className="px-4 pt-3 text-xs text-muted-foreground lg:hidden">
          Zaman çizelgesini yatay kaydırarak tüm sütunları görebilirsiniz.
        </p>
        <div
          className="relative min-w-max"
          style={{ width: 140 + timelineWidth }}
        >
          <div className="sticky top-0 z-20 flex border-b border-border bg-card">
            <div className="sticky left-0 z-30 w-[140px] shrink-0 border-r border-border bg-card px-3 py-3 text-xs font-medium text-muted-foreground shadow-[4px_0_12px_-4px_rgb(0_0_0/0.35)]">
              Makine
            </div>
            <div className="flex" style={{ width: timelineWidth }}>
              {columns.map((col) => (
                <div
                  key={col.id}
                  className={cn(
                    "shrink-0 border-r border-border px-2 py-2 text-center last:border-r-0",
                    col.isToday && "border-t-2 border-t-primary bg-primary-subtle"
                  )}
                  style={{ width: colWidth }}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xs font-medium tabular-nums text-foreground">
                      {col.label}
                    </span>
                    {col.sublabel ? (
                      <span className="text-xs text-muted-foreground">
                        {col.sublabel}
                      </span>
                    ) : null}
                    {col.isToday ? (
                      <span className="text-xs font-medium text-primary">Bugün</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {machines.map((machine) => {
            const state = deriveMachineState(machine);
            const rowJobs = jobsByMachine.get(machine.id) ?? [];
            return (
              <div
                key={machine.id}
                className="flex border-b border-border last:border-b-0"
              >
                <div className="sticky left-0 z-10 flex w-[140px] shrink-0 items-center gap-2 border-r border-border bg-card px-3 py-2 shadow-[4px_0_12px_-4px_rgb(0_0_0/0.35)]">
                  <MachineStateDot state={state} />
                  <span className="truncate text-sm font-medium text-foreground">
                    {machine.name}
                  </span>
                </div>
                <div
                  className="relative h-11 shrink-0 bg-surface-inset/20"
                  style={{ width: timelineWidth }}
                >
                  {zoom === "day"
                    ? columns.map((col) =>
                        isWeekendDate(col.id) && col.id !== today ? (
                          <div
                            key={col.id}
                            className="pointer-events-none absolute inset-y-0 bg-surface-inset/50"
                            style={{
                              left: `${((col.startMs - bounds.startMs) / (bounds.endMs - bounds.startMs)) * 100}%`,
                              width: `${((col.endMs - col.startMs) / (bounds.endMs - bounds.startMs)) * 100}%`,
                            }}
                            aria-hidden
                          />
                        ) : null
                      )
                    : null}
                  {todayPercent != null ? (
                    <div
                      className="pointer-events-none absolute inset-y-0 z-[2] w-0.5 bg-primary"
                      style={{ left: `${todayPercent}%` }}
                      aria-hidden
                    />
                  ) : null}
                  {rowJobs.map((job) => {
                    const range = jobTimeRange(job.job_date, job.duration_minutes);
                    const layout = layoutBarOnTimeline(
                      range,
                      bounds.startMs,
                      bounds.endMs
                    );
                    if (!layout) return null;
                    return (
                      <GanttJobBar
                        key={job.id}
                        job={job}
                        layout={layout}
                        onOpen={() => onJobOpen(job)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <details className="rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]">
          Erişilebilir tablo özeti
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Ekran okuyucular ve klavye kullanıcıları için siparişlerin makine ve
          tarih aralığı tablosu.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">
              Gantt görünümü siparişleri — makine, başlangıç, süre
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="px-2 py-2 font-medium">
                  Makine
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Sipariş
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Başlangıç
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Aralık
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody>
              {machines.flatMap((machine) => {
                const rowJobs = jobsByMachine.get(machine.id) ?? [];
                if (rowJobs.length === 0) {
                  return (
                    <tr key={machine.id} className="border-b border-border">
                      <td className="px-2 py-2">{machine.name}</td>
                      <td colSpan={4} className="px-2 py-2 text-muted-foreground">
                        Planlı sipariş yok
                      </td>
                    </tr>
                  );
                }
                return rowJobs.map((job) => {
                  const title = job.title ?? job.customer?.name ?? "Sipariş";
                  return (
                    <tr key={job.id} className="border-b border-border">
                      <td className="px-2 py-2">{machine.name}</td>
                      <td className="px-2 py-2">{title}</td>
                      <td className="px-2 py-2 tabular-nums">
                        {formatDate(job.job_date)}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {formatJobRangeLabel(job.job_date, job.duration_minutes)}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                          onClick={() => onJobOpen(job)}
                        >
                          Aç
                        </button>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
