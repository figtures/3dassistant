"use client";

import { useMemo } from "react";
import { useFleetLiveSse } from "@/hooks/use-machine-sse";
import { useJobs, useMaterials } from "@/hooks/use-data";
import { deriveMachineState } from "@/lib/machine-state";
import {
  collectLowStockItems,
  consumptionByColorFromJobs,
} from "@/lib/stock";

export type AttentionItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
  tone: "error" | "warning";
};

export function useAttentionItems(): {
  items: AttentionItem[];
  isLoading: boolean;
} {
  const fleet = useFleetLiveSse();
  const jobsQuery = useJobs();
  const materialsQuery = useMaterials();

  const items = useMemo((): AttentionItem[] => {
    const list: AttentionItem[] = [];

    for (const m of fleet) {
      if (deriveMachineState(m) === "error") {
        list.push({
          id: `machine-error-${m.id}`,
          label: m.name,
          detail: "Makine hata durumunda",
          href: `/machines/${m.id}`,
          tone: "error",
        });
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const jobs = jobsQuery.data ?? [];
    for (const job of jobs) {
      if (!job.delivery_date) continue;
      if (job.status === "completed" || job.status === "cancelled") continue;
      const due = new Date(job.delivery_date);
      due.setHours(0, 0, 0, 0);
      if (due >= today) continue;
      const diffDays = Math.floor(
        (today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000)
      );
      list.push({
        id: `overdue-${job.id}`,
        label: job.title ?? "Sipariş",
        detail:
          diffDays <= 1
            ? "Teslim tarihi geçti"
            : `${diffDays} gün gecikti`,
        href: `/planning?order=${job.id}`,
        tone: "warning",
      });
    }

    const consumption = consumptionByColorFromJobs(jobs);
    const lowStock = collectLowStockItems(materialsQuery.data ?? [], consumption);
    for (const row of lowStock.slice(0, 8)) {
      const daysHint =
        row.daysLeft != null
          ? row.daysLeft === 0
            ? "Stok tükendi"
            : `~${row.daysLeft} gün yetebilir`
          : `${row.stockGrams} g kaldı (eşik ${row.thresholdGrams} g)`;
      list.push({
        id: `stock-${row.colorId}`,
        label: `${row.materialName} · ${row.colorName}`,
        detail: daysHint,
        href: `/procurement?new=1&material=${row.materialId}&color=${row.colorId}`,
        tone: "warning",
      });
    }

    return list;
  }, [fleet, jobsQuery.data, materialsQuery.data]);

  return {
    items,
    isLoading: jobsQuery.isLoading || materialsQuery.isLoading,
  };
}
