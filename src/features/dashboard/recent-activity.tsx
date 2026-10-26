"use client";

import Link from "next/link";
import { useRecentJobs } from "@/hooks/use-data";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/types/database";
import { ChevronRight } from "lucide-react";

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Bekliyor",
  in_progress: "Üretimde",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

function ActivitySkeleton() {
  return (
    <div className="space-y-2 motion-reduce:animate-none animate-pulse" aria-busy="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-muted/60" />
      ))}
    </div>
  );
}

export function RecentActivity() {
  const { data: jobs = [], isLoading, isError, refetch } = useRecentJobs(8);

  return (
    <section
      className="rounded-xl border border-border bg-card"
      aria-labelledby="recent-activity-heading"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2
          id="recent-activity-heading"
          className="text-base font-semibold text-foreground"
        >
          Son güncellenen işler
        </h2>
        <Link
          href="/planning"
          className="text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          Planlama
        </Link>
      </div>

      <div className="p-3">
        {isLoading && <ActivitySkeleton />}

        {isError && (
          <div className="px-2 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Son işler yüklenemedi.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-2 text-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              Tekrar dene
            </button>
          </div>
        )}

        {!isLoading && !isError && jobs.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Henüz iş kaydı yok. Planlamadan ilk siparişinizi ekleyin.
          </p>
        )}

        {!isLoading && !isError && jobs.length > 0 && (
          <ul className="divide-y divide-border">
            {jobs.map((job) => {
              const title =
                job.title?.trim() ||
                job.customer?.name ||
                job.machine?.name ||
                "İsimsiz iş";
              const updated = job.updated_at?.slice(0, 10) ?? job.job_date;
              return (
                <li key={job.id}>
                  <Link
                    href="/planning"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-2 py-3 transition-colors",
                      "hover:bg-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {STATUS_LABEL[job.status]} ·{" "}
                        {formatDateShort(updated)}
                        {job.machine?.name
                          ? ` · ${job.machine.name}`
                          : null}
                      </p>
                    </div>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
