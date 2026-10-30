"use client";

import { useMemo } from "react";
import { useFleetLiveSse } from "@/hooks/use-machine-sse";
import { useJobs, useMaterials } from "@/hooks/use-data";
import { deriveMachineState } from "@/lib/machine-state";
import type { NavBadgeKey } from "@/lib/nav";
import { isLowStock, lowStockThreshold } from "@/lib/stock";

export type NavBadges = Partial<Record<NavBadgeKey, number>>;

export function useNavBadges(): NavBadges {
  const fleet = useFleetLiveSse();
  const { data: jobs } = useJobs();
  const { data: materials } = useMaterials();

  return useMemo(() => {
    const badges: NavBadges = {};

    const errorCount = fleet.filter(
      (m) => deriveMachineState(m) === "error"
    ).length;
    if (errorCount > 0) badges.machineErrors = errorCount;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue =
      jobs?.filter((job) => {
        if (!job.delivery_date) return false;
        if (job.status === "completed" || job.status === "cancelled") {
          return false;
        }
        const due = new Date(job.delivery_date);
        due.setHours(0, 0, 0, 0);
        return due < today;
      }).length ?? 0;
    if (overdue > 0) badges.overdueOrders = overdue;

    let lowStock = 0;
    for (const material of materials ?? []) {
      for (const color of material.material_colors ?? []) {
        if (
          isLowStock(color.stock_grams, lowStockThreshold(color.low_stock_grams))
        ) {
          lowStock += 1;
        }
      }
    }
    if (lowStock > 0) badges.lowStock = lowStock;

    return badges;
  }, [fleet, jobs, materials]);
}
