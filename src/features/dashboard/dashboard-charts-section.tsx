"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
  computeMetrics,
  getDefaultFilters,
  mergeBusinessMetrics,
  useCatalogItems,
  useCatalogSales,
  useCustomers,
  useFaults,
  useJobs,
  useMaterialPurchases,
} from "@/hooks/use-data";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";

const DashboardCharts = dynamic(
  () =>
    import("@/components/dashboard/dashboard-charts").then((m) => ({
      default: m.DashboardCharts,
    })),
  {
    ssr: false,
    loading: () => <DashboardChartsSkeleton />,
  }
);

export function DashboardChartsSection() {
  const filters = useMemo(() => getDefaultFilters(), []);
  const jobsQuery = useJobs(filters);
  const { data: customers = [] } = useCustomers();
  const { data: faults = [] } = useFaults();
  const { data: purchases = [] } = useMaterialPurchases();
  const { data: catalogItems = [] } = useCatalogItems();
  const { data: sales = [] } = useCatalogSales();

  const metrics = useMemo(() => {
    const jobs = jobsQuery.data ?? [];
    const base = computeMetrics(jobs, customers, faults);
    return mergeBusinessMetrics(base, purchases, catalogItems, sales);
  }, [
    jobsQuery.data,
    customers,
    faults,
    purchases,
    catalogItems,
    sales,
  ]);

  if (jobsQuery.isError) {
    return (
      <section
        className="rounded-xl border border-border bg-card p-5"
        aria-labelledby="dashboard-charts-heading"
      >
        <HelpTitleRow>
          <h2
            id="dashboard-charts-heading"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Analitik
          </h2>
        </HelpTitleRow>
        <p className="mt-3 text-sm text-muted-foreground">
          Grafikler yüklenemedi.
        </p>
        <button
          type="button"
          onClick={() => void jobsQuery.refetch()}
          className="mt-3 text-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          Tekrar dene
        </button>
      </section>
    );
  }

  if (jobsQuery.isLoading) {
    return (
      <section aria-labelledby="dashboard-charts-heading" aria-busy="true">
        <HelpTitleRow>
          <h2
            id="dashboard-charts-heading"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Analitik
          </h2>
        </HelpTitleRow>
        <div className="mt-4">
          <DashboardChartsSkeleton />
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="dashboard-charts-heading">
      <HelpTitleRow>
        <h2
          id="dashboard-charts-heading"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Analitik
        </h2>
      </HelpTitleRow>
      <div className="mt-4">
        <DashboardCharts metrics={metrics} />
      </div>
    </section>
  );
}

function DashboardChartsSkeleton() {
  return (
    <div
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      aria-hidden
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-[332px] rounded-2xl border border-border bg-card motion-reduce:animate-none animate-pulse"
        />
      ))}
    </div>
  );
}
