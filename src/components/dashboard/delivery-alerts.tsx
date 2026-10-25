"use client";

import Link from "next/link";
import type { Job } from "@/types/database";
import {
  computeDeliveryAlerts,
  formatDeliveryDate,
  totalDeliveryAlerts,
  type DeliveryAlertKind,
} from "@/lib/delivery-alerts";
import { cn, formatCurrency } from "@/lib/utils";
import { AlertTriangle, CalendarClock, CalendarDays, ChevronRight } from "lucide-react";

const KIND_STYLES: Record<
  DeliveryAlertKind,
  { border: string; bg: string; text: string; icon: typeof AlertTriangle }
> = {
  overdue: {
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    text: "text-red-400",
    icon: AlertTriangle,
  },
  today: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    text: "text-amber-400",
    icon: CalendarClock,
  },
  tomorrow: {
    border: "border-sky-500/30",
    bg: "bg-sky-500/5",
    text: "text-sky-400",
    icon: CalendarDays,
  },
};

interface DeliveryAlertsProps {
  jobs: Job[];
  onSelectJob?: (job: Job) => void;
  showCalendarLink?: boolean;
  className?: string;
}

export function DeliveryAlerts({
  jobs,
  onSelectJob,
  showCalendarLink = true,
  className,
}: DeliveryAlertsProps) {
  const groups = computeDeliveryAlerts(jobs);
  const total = totalDeliveryAlerts(groups);

  if (total === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-500",
          className
        )}
      >
        Aktif teslim uyarısı yok — bugün, yarın veya geciken iş bulunmuyor.
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Teslim Uyarıları</h2>
          <p className="text-xs text-zinc-500">
            {total} iş dikkat gerektiriyor
          </p>
        </div>
        {showCalendarLink && (
          <Link
            href="/calendar"
            className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
          >
            Takvime git
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {groups.map((group) => {
          const style = KIND_STYLES[group.kind];
          const Icon = style.icon;

          return (
            <div
              key={group.kind}
              className={cn(
                "rounded-2xl border p-4",
                style.border,
                style.bg
              )}
            >
              <div className="mb-3 flex items-start gap-2">
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.text)} />
                <div>
                  <p className={cn("text-sm font-semibold", style.text)}>
                    {group.label}
                    <span className="ml-1.5 text-xs font-normal opacity-80">
                      ({group.jobs.length})
                    </span>
                  </p>
                  <p className="text-[11px] text-zinc-500">{group.description}</p>
                </div>
              </div>

              <ul className="space-y-1.5">
                {group.jobs.map((job) => (
                  <li key={job.id}>
                    {onSelectJob ? (
                      <button
                        type="button"
                        onClick={() => onSelectJob(job)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-800/60 bg-zinc-950/50 px-3 py-2 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900/80"
                      >
                        <JobAlertRow job={job} accent={style.text} />
                      </button>
                    ) : (
                      <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/50 px-3 py-2">
                        <JobAlertRow job={job} accent={style.text} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JobAlertRow({ job, accent }: { job: Job; accent: string }) {
  return (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-200">
          {job.title ?? "İsimsiz iş"}
        </p>
        <p className="truncate text-[11px] text-zinc-500">
          {job.customer?.name ?? "Müşteri yok"} · {job.machine?.name ?? "—"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("text-[11px] font-medium", accent)}>
          {job.delivery_date ? formatDeliveryDate(job.delivery_date) : "—"}
        </p>
        {job.revenue_amount != null && job.revenue_amount > 0 && (
          <p className="text-[10px] text-zinc-600">
            {formatCurrency(job.revenue_amount)}
          </p>
        )}
      </div>
    </>
  );
}
