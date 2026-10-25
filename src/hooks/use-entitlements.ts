"use client";

import { useQuery } from "@tanstack/react-query";
import type { Entitlements } from "@/lib/billing/entitlements";

export type EntitlementsResponse = {
  entitlements: Entitlements;
  usage: { machines: number; cloudMachines: number };
  billingAvailable: boolean;
};

export const ENTITLEMENTS_QUERY_KEY = ["entitlements"] as const;

export async function fetchEntitlements(): Promise<EntitlementsResponse> {
  const res = await fetch("/api/billing/entitlements", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Plan bilgisi alınamadı");
  return data as EntitlementsResponse;
}

export function useEntitlements() {
  return useQuery({ queryKey: ENTITLEMENTS_QUERY_KEY, queryFn: fetchEntitlements });
}

export function machineSlotsLeft(data: EntitlementsResponse | undefined): number | null {
  if (!data) return null;
  return Math.max(0, data.entitlements.maxMachines - data.usage.machines);
}
