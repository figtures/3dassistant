import type { SupabaseClient } from "@supabase/supabase-js";
import { isEntitledStatus, PLANS, type PlanKey, type SubscriptionStatus } from "./plans";

export interface SubscriptionRow {
  user_id: string;
  paddle_subscription_id: string;
  paddle_customer_id: string;
  plan_key: Exclude<PlanKey, "free">;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at: string | null;
  max_machines: number;
  cloud_monitoring: boolean;
  sync_per_tick: number;
}

export interface Entitlements {
  planKey: PlanKey;
  planName: string;
  maxMachines: number;
  cloudMonitoring: boolean;
  syncPerTick: number;
  subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
    cancelAt: string | null;
    hasPaddleSubscription: boolean;
  } | null;
}

export const SUBSCRIPTION_COLUMNS =
  "user_id, paddle_subscription_id, paddle_customer_id, plan_key, status, current_period_end, cancel_at, max_machines, cloud_monitoring, sync_per_tick";

/** Abonelik satırından etkin hakları üretir; satır yoksa veya geçersizse ücretsiz katman. */
export function entitlementsFromSubscription(row: SubscriptionRow | null): Entitlements {
  const subscription = row
    ? {
        status: row.status,
        currentPeriodEnd: row.current_period_end,
        cancelAt: row.cancel_at,
        hasPaddleSubscription: !row.paddle_subscription_id.startsWith("dev_"),
      }
    : null;

  if (!row || !isEntitledStatus(row.status)) {
    const free = PLANS.free;
    return {
      planKey: "free",
      planName: free.name,
      maxMachines: free.maxMachines,
      cloudMonitoring: free.cloudMonitoring,
      syncPerTick: free.syncPerTick,
      subscription,
    };
  }

  return {
    planKey: row.plan_key,
    planName: PLANS[row.plan_key].name,
    maxMachines: row.max_machines,
    cloudMonitoring: row.cloud_monitoring,
    syncPerTick: row.sync_per_tick,
    subscription,
  };
}

export async function getSubscriptionRow(
  supabase: SupabaseClient,
  userId: string
): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(SUBSCRIPTION_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SubscriptionRow | null) ?? null;
}

export async function getEntitlements(
  supabase: SupabaseClient,
  userId: string
): Promise<Entitlements> {
  return entitlementsFromSubscription(await getSubscriptionRow(supabase, userId));
}

export async function getMachineUsage(supabase: SupabaseClient, userId: string) {
  const [machines, cloud] = await Promise.all([
    supabase.from("machines").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("machine_cloud_links")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("enabled", true),
  ]);
  if (machines.error) throw new Error(machines.error.message);
  if (cloud.error) throw new Error(cloud.error.message);
  return { machines: machines.count ?? 0, cloudMachines: cloud.count ?? 0 };
}

export const PLAN_ERROR = {
  cloudRequired: "PLAN_CLOUD_REQUIRED",
  machineLimit: "PLAN_MACHINE_LIMIT",
} as const;

export function cloudRequiredMessage(): string {
  return "Ücretsiz planda buluttan makine bağlama kilitlidir. Atölye veya Filament Farm planına geçin.";
}

export function machineLimitMessage(max: number): string {
  return `Planınız en fazla ${max} makineye izin veriyor. Daha fazlası için planınızı yükseltin.`;
}
