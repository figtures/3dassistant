"use client";

import { FleetOverviewV2 } from "@/features/dashboard/fleet-overview-v2";
import { KpiRow, KpiRowSkeleton } from "@/features/dashboard/kpi-row";
import { QuickLinks } from "@/features/dashboard/quick-links";
import { RecentActivity } from "@/features/dashboard/recent-activity";
import { useDashboardKpis } from "@/features/dashboard/use-dashboard-kpis";
import { formatDate } from "@/lib/format";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

type DashboardV2Props = {
  displayName: string;
};

export function DashboardV2({ displayName }: DashboardV2Props) {
  const { kpis, isLoading, isError, refetch } = useDashboardKpis();
  const now = new Date();
  const greeting = greetingForHour(now.getHours());
  const todayLabel = formatDate(now);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {greeting}, {displayName}
        </h1>
        <p className="text-sm text-muted-foreground">{todayLabel}</p>
      </header>

      {isError ? (
        <div
          className="rounded-xl border border-border bg-card p-5"
          role="alert"
        >
          <p className="text-sm text-foreground">
            Özet metrikler yüklenemedi.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 text-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            Tekrar dene
          </button>
        </div>
      ) : isLoading ? (
        <KpiRowSkeleton />
      ) : (
        <KpiRow kpis={kpis} />
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <FleetOverviewV2 />
          <QuickLinks />
        </div>
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}
