"use client";

import type { ReactNode } from "react";
import { useEntitlements } from "@/hooks/use-entitlements";
import {
  planMeetsFeature,
  type BillableFeature,
} from "@/lib/billing/features";

export type PlanGateProps = {
  feature: BillableFeature;
  children: ReactNode;
  fallback?: ReactNode;
};

export function PlanGate({ feature, children, fallback = null }: PlanGateProps) {
  const { data } = useEntitlements();
  const planKey = data?.entitlements.planKey ?? "free";
  if (planMeetsFeature(planKey, feature)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}
