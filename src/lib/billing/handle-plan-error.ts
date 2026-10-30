"use client";

import { PLAN_ERROR } from "@/lib/billing/entitlements";
import type { BillableFeature } from "@/lib/billing/features";
import { useUpgradePromptStore } from "@/lib/billing/upgrade-prompt-store";

export type PlanErrorBody = {
  error?: string;
  code?: string;
  hint?: string;
};

function featureFromBody(body: PlanErrorBody | null | undefined): BillableFeature {
  const code = body?.code ?? body?.hint;
  if (code === PLAN_ERROR.machineLimit) return "machine_slots";
  if (code === PLAN_ERROR.cloudRequired) return "cloud_sync";
  return "cloud_sync";
}

/** 402 / plan limit yanıtında bağlamsal yükseltme diyaloğunu açar. */
export function openUpgradePromptFromPlanError(
  body?: PlanErrorBody | null,
  featureOverride?: BillableFeature
): void {
  const feature = featureOverride ?? featureFromBody(body ?? undefined);
  useUpgradePromptStore.getState().show({
    feature,
    message: body?.error,
  });
}

export async function parseJsonBody(res: Response): Promise<PlanErrorBody> {
  return (await res.json().catch(() => ({}))) as PlanErrorBody;
}

/** Fetch yanıtı plan engeli ise true döner ve prompt açılır. */
export async function handlePlanErrorResponse(
  res: Response,
  body?: PlanErrorBody | null,
  featureOverride?: BillableFeature
): Promise<boolean> {
  if (res.status !== 402) return false;
  const data = body ?? (await parseJsonBody(res));
  openUpgradePromptFromPlanError(data, featureOverride);
  return true;
}
