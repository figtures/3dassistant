"use client";

import { useMemo } from "react";
import { useFleetLiveSse } from "@/hooks/use-machine-sse";
import { useJobs, useMaterials } from "@/hooks/use-data";
import { deriveMachineState } from "@/lib/machine-state";
import { isLowStock, lowStockThreshold } from "@/lib/stock";

export type DashboardKpis = {
  activeJobs: number;
  printingMachines: number;
  overdueOrders: number;
  criticalStock: number;
  machineErrors: number;
};

export function useDashboardKpis(): {
  kpis: DashboardKpis;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const fleet = useFleetLiveSse();
  const jobsQuery = useJobs();
  const materialsQuery = useMaterials();

  const kpis = useMemo((): DashboardKpis => {
    const jobs = jobsQuery.data ?? [];

    const activeJobs = jobs.filter(
      (j) => j.status === "pending" || j.status === "in_progress"
    ).length;

    let printingMachines = 0;
    let machineErrors = 0;
    for (const m of fleet) {
      const state = deriveMachineState(m);
      if (state === "printing") printingMachines += 1;
      if (state === "error") machineErrors += 1;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueOrders = jobs.filter((job) => {
      if (!job.delivery_date) return false;
      if (job.status === "completed" || job.status === "cancelled") return false;
      const due = new Date(job.delivery_date);
      due.setHours(0, 0, 0, 0);
      return due < today;
    }).length;

    let criticalStock = 0;
    for (const material of materialsQuery.data ?? []) {
      for (const color of material.material_colors ?? []) {
        if (
          isLowStock(color.stock_grams, lowStockThreshold(color.low_stock_grams))
        ) {
          criticalStock += 1;
        }
      }
    }

    return {
      activeJobs,
      printingMachines,
      overdueOrders,
      criticalStock,
      machineErrors,
    };
  }, [fleet, jobsQuery.data, materialsQuery.data]);

  return {
    kpis,
    isLoading: jobsQuery.isLoading || materialsQuery.isLoading,
    isError: jobsQuery.isError || materialsQuery.isError,
    refetch: () => {
      void jobsQuery.refetch();
      void materialsQuery.refetch();
    },
  };
}
