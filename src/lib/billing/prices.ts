import type { PaidPlanKey, PlanKey } from "@/lib/billing/plans";
import { PAID_PLAN_KEYS, PLANS } from "@/lib/billing/plans";

export type BillingInterval = "month" | "year";

const MONTHLY_DISPLAY_ENV: Record<PaidPlanKey, string> = {
  starter: "NEXT_PUBLIC_PRICE_STARTER_MONTHLY_TRY",
  pro: "NEXT_PUBLIC_PRICE_PRO_MONTHLY_TRY",
  farm: "NEXT_PUBLIC_PRICE_FARM_MONTHLY_TRY",
};

const YEARLY_DISPLAY_ENV: Record<PaidPlanKey, string> = {
  starter: "NEXT_PUBLIC_PRICE_STARTER_YEARLY_TRY",
  pro: "NEXT_PUBLIC_PRICE_PRO_YEARLY_TRY",
  farm: "NEXT_PUBLIC_PRICE_FARM_YEARLY_TRY",
};

/** Env'de fiyat yokken gösterilir — uydurma tutar kullanılmaz. */
export const PRICE_UNAVAILABLE_LABEL = "Yakında";

function readTryAmount(envKey: string): number | null {
  const raw = process.env[envKey]?.trim();
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function formatTryAmount(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function displayPriceLabel(plan: PlanKey, interval: BillingInterval): string {
  if (plan === "free") return "Ücretsiz";
  const envKey = interval === "year" ? YEARLY_DISPLAY_ENV[plan] : MONTHLY_DISPLAY_ENV[plan];
  const amount = readTryAmount(envKey);
  if (amount == null) return PRICE_UNAVAILABLE_LABEL;
  const formatted = formatTryAmount(amount);
  return interval === "year" ? `${formatted} / yıl` : `${formatted} / ay`;
}

export function hasYearlyDisplayPrices(): boolean {
  return PAID_PLAN_KEYS.some((key) => readTryAmount(YEARLY_DISPLAY_ENV[key]) != null);
}

export function planCardRows(interval: BillingInterval): Array<{
  key: PlanKey;
  name: string;
  tagline: string;
  features: string[];
  maxMachines: number;
  cloudMonitoring: boolean;
  priceLabel: string;
  recommended: boolean;
}> {
  const keys: PlanKey[] = ["free", ...PAID_PLAN_KEYS];
  return keys.map((key) => {
    const plan = PLANS[key];
    return {
      key,
      name: plan.name,
      tagline: plan.tagline,
      features: plan.features,
      maxMachines: plan.maxMachines,
      cloudMonitoring: plan.cloudMonitoring,
      priceLabel: displayPriceLabel(key, interval),
      recommended: key === "pro",
    };
  });
}
