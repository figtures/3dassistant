export type PlanKey = "free" | "starter" | "pro" | "farm";
export type PaidPlanKey = Exclude<PlanKey, "free">;

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "paused";

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  tagline: string;
  maxMachines: number;
  cloudMonitoring: boolean;
  /** Bulut senkron cron'unda bu kiracı için tick başına en fazla kaç yazıcı çekilir */
  syncPerTick: number;
  features: string[];
}

export const PLANS: Record<PlanKey, PlanDefinition> = {
  // supabase/migrations/016_subscriptions.sql effective_entitlements() ile aynı tutulmalı
  free: {
    key: "free",
    name: "Ücretsiz",
    tagline: "Denemek için",
    maxMachines: 2,
    cloudMonitoring: false,
    syncPerTick: 0,
    features: ["2 makine", "Planlama, stok, müşteri, katalog"],
  },
  starter: {
    key: "starter",
    name: "Starter",
    tagline: "Tek kişilik atölye",
    maxMachines: 5,
    cloudMonitoring: false,
    syncPerTick: 0,
    features: ["5 makine", "Planlama, stok, tedarik, katalog", "Müşteri ve teslim takibi"],
  },
  pro: {
    key: "pro",
    name: "Atölye",
    tagline: "Canlı yazıcı takibi",
    maxMachines: 8,
    cloudMonitoring: true,
    syncPerTick: 8,
    features: ["8 makine", "Starter'daki her şey", "Bambu ve Creality bulut ile canlı yazıcı durumu"],
  },
  farm: {
    key: "farm",
    name: "Filament Farm",
    tagline: "Çok yazıcılı üretim",
    maxMachines: 40,
    cloudMonitoring: true,
    syncPerTick: 20,
    features: ["40 makine", "Atölye'deki her şey", "Bambu + Creality, öncelikli canlı senkron"],
  },
};

export const PAID_PLAN_KEYS: PaidPlanKey[] = ["starter", "pro", "farm"];

/** Bu durumlarda plan hakları geçerlidir; past_due ödeme yeniden denenirken kesinti yaratmaz. */
export const ENTITLED_STATUSES: SubscriptionStatus[] = ["trialing", "active", "past_due"];

export function isPaidPlanKey(value: unknown): value is PaidPlanKey {
  return value === "starter" || value === "pro" || value === "farm";
}

export function isEntitledStatus(status: string | null | undefined): boolean {
  return ENTITLED_STATUSES.includes(status as SubscriptionStatus);
}

const PRICE_ENV: Record<PaidPlanKey, string> = {
  starter: "PADDLE_STARTER_PRICE_ID",
  pro: "PADDLE_PRO_PRICE_ID",
  farm: "PADDLE_FARM_PRICE_ID",
};

const YEARLY_PRICE_ENV: Record<PaidPlanKey, string> = {
  starter: "PADDLE_STARTER_YEARLY_PRICE_ID",
  pro: "PADDLE_PRO_YEARLY_PRICE_ID",
  farm: "PADDLE_FARM_YEARLY_PRICE_ID",
};

export type BillingInterval = "month" | "year";

export function yearlyPriceIdForPlan(plan: PaidPlanKey): string | null {
  return process.env[YEARLY_PRICE_ENV[plan]]?.trim() || null;
}

export function hasYearlyCheckoutPrices(): boolean {
  return PAID_PLAN_KEYS.some((key) => Boolean(yearlyPriceIdForPlan(key)));
}

export function priceIdForPlan(
  plan: PaidPlanKey,
  interval: BillingInterval = "month"
): string | null {
  if (interval === "year") return yearlyPriceIdForPlan(plan);
  return process.env[PRICE_ENV[plan]]?.trim() || null;
}

export function planKeyForPriceId(priceId: string | null | undefined): PaidPlanKey | null {
  if (!priceId) return null;
  return PAID_PLAN_KEYS.find((key) => priceIdForPlan(key) === priceId) ?? null;
}
