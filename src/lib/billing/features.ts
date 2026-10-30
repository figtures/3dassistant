import {
  PAID_PLAN_KEYS,
  PLANS,
  type PaidPlanKey,
  type PlanKey,
} from "@/lib/billing/plans";

export type BillableFeature =
  | "cloud_sync"
  | "bridge_pairing"
  | "machine_slots";

const FEATURE_MIN_PLAN: Record<BillableFeature, PaidPlanKey> = {
  cloud_sync: "pro",
  bridge_pairing: "pro",
  machine_slots: "starter",
};

export const FEATURE_COPY: Record<
  BillableFeature,
  { title: string; description: string }
> = {
  cloud_sync: {
    title: "Bulut yazıcı senkronu",
    description:
      "Bambu ve Creality bulut bağlantısı ile canlı durum, sıcaklık ve ilerleme takibi.",
  },
  bridge_pairing: {
    title: "Atölye köprüsü ile canlı takip",
    description:
      "Yerel ağdaki yazıcıları köprü ile bağlayıp canlı üretim verisi alın.",
  },
  machine_slots: {
    title: "Daha fazla makine",
    description: "Planınızdaki makine limitini aşmak için yükseltme gerekir.",
  },
};

export function minimumPlanForFeature(feature: BillableFeature): PaidPlanKey {
  return FEATURE_MIN_PLAN[feature];
}

export function suggestedUpgradePlan(
  currentPlan: PlanKey,
  feature: BillableFeature
): PaidPlanKey {
  const min = minimumPlanForFeature(feature);
  const order: PlanKey[] = ["free", ...PAID_PLAN_KEYS];
  const minIdx = order.indexOf(min);
  const curIdx = order.indexOf(currentPlan);
  if (curIdx >= minIdx) {
    const nextIdx = Math.min(order.length - 1, curIdx + 1);
    const next = order[nextIdx];
    return (next === "free" ? min : next) as PaidPlanKey;
  }
  return min;
}

export function planMeetsFeature(plan: PlanKey, feature: BillableFeature): boolean {
  const target = minimumPlanForFeature(feature);
  const order: PlanKey[] = ["free", ...PAID_PLAN_KEYS];
  return order.indexOf(plan) >= order.indexOf(target);
}

export function featureUnlockSummary(feature: BillableFeature, plan: PaidPlanKey): string {
  const def = PLANS[plan];
  if (feature === "machine_slots") {
    return `${def.maxMachines} makineye kadar`;
  }
  if (feature === "cloud_sync" || feature === "bridge_pairing") {
    return def.cloudMonitoring
      ? "Canlı bulut ve köprü takibi"
      : def.features.join(" · ");
  }
  return def.tagline;
}
