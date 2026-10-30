"use client";

import { useMemo } from "react";
import { format, parseISO, startOfDay } from "date-fns";
import { tr } from "date-fns/locale";
import type { Job } from "@/types/database";
import { cn } from "@/lib/utils";

export type AgendaListProps = {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
};

export function AgendaList({ jobs, onSelectJob }: AgendaListProps) {
  const today = startOfDay(new Date());

  const grouped = useMemo(() => {
    const sorted = [...jobs].sort((a, b) =>
      (a.delivery_date ?? "").localeCompare(b.delivery_date ?? "")
    );
    const map = new Map<string, Job[]>();
    for (const job of sorted) {
      if (!job.delivery_date) continue;
      const list = map.get(job.delivery_date) ?? [];
      list.push(job);
      map.set(job.delivery_date, list);
    }
    return [...map.entries()];
  }, [jobs]);

  function isOverdue(job: Job) {
    if (!job.delivery_date) return false;
    if (job.status === "completed" || job.status === "cancelled") return false;
    return startOfDay(parseISO(job.delivery_date)) < today;
  }

  if (grouped.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Bu aralıkta teslim tarihi olan sipariş yok.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([dateKey, dayJobs]) => (
        <section key={dateKey} className="rounded-xl border border-border bg-card">
          <h3 className="border-b border-border px-4 py-2 text-sm font-semibold text-foreground">
            {format(parseISO(dateKey), "d MMMM yyyy, EEEE", { locale: tr })}
          </h3>
          <ul className="divide-y divide-border">
            {dayJobs.map((job) => (
              <li key={job.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-accent/50",
                    isOverdue(job) && "bg-destructive/5"
                  )}
                  onClick={() => onSelectJob(job)}
                >
                  <span
                    className="mt-1 h-8 w-1 shrink-0 rounded-full"
                    style={{ background: job.cell_color ?? "#3b82f6" }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {job.title ?? "İsimsiz"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {job.status === "pending"
                        ? "Bekliyor"
                        : job.status === "in_progress"
                          ? "Devam ediyor"
                          : job.status === "completed"
                            ? "Tamamlandı"
                            : "İptal"}
                      {isOverdue(job) ? " · Gecikmiş" : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
