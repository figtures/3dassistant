import type { SupabaseClient } from "@supabase/supabase-js";
import { isEntitledStatus, isPaidPlanKey, PLANS, type PaidPlanKey } from "./plans";
import { getSubscriptionRow } from "./entitlements";

/** Uygulama içi deneme süresi (Paddle trial yokken). */
export const APP_TRIAL_DAYS = 14;

/** Topbar’da vurgulu gösterim eşiği. */
export const TRIAL_URGENT_DAYS = 5;

export type SignupIntent = {
  plan: PaidPlanKey;
  trial: boolean;
};

export function parseSignupIntent(
  metadata: Record<string, unknown> | null | undefined
): SignupIntent | null {
  if (!metadata || typeof metadata !== "object") return null;
  const signup = metadata.signup;
  if (!signup || typeof signup !== "object") return null;
  const raw = signup as { plan?: unknown; trial?: unknown };
  if (raw.trial !== true && raw.trial !== 1 && raw.trial !== "1") return null;
  const plan = isPaidPlanKey(raw.plan) ? raw.plan : "pro";
  return { plan, trial: true };
}

export function trialPeriodEndIso(fromMs = Date.now()): string {
  return new Date(fromMs + APP_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function trialDaysRemaining(
  periodEndIso: string | null | undefined,
  nowMs = Date.now()
): number | null {
  if (!periodEndIso) return null;
  const end = Date.parse(periodEndIso);
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - nowMs) / (24 * 60 * 60 * 1000)));
}

export type EnsureAppTrialResult =
  | { status: "skipped"; reason: string }
  | { status: "existing" }
  | { status: "started"; plan: PaidPlanKey };

/** Paddle hazır değilken metadata’daki deneme niyetini `dev_` aboneliğe yazar. */
export async function ensureAppTrial(
  admin: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown> | null | undefined
): Promise<EnsureAppTrialResult> {
  const intent = parseSignupIntent(metadata);
  if (!intent) {
    return { status: "skipped", reason: "no_trial_intent" };
  }

  const existing = await getSubscriptionRow(admin, userId);
  if (existing && isEntitledStatus(existing.status)) {
    return { status: "existing" };
  }

  const planDef = PLANS[intent.plan];
  const periodEnd = trialPeriodEndIso();
  const devId = `dev_${userId}`;

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      paddle_subscription_id: devId,
      paddle_customer_id: devId,
      plan_key: intent.plan,
      status: "trialing",
      current_period_end: periodEnd,
      cancel_at: null,
      max_machines: planDef.maxMachines,
      cloud_monitoring: planDef.cloudMonitoring,
      sync_per_tick: planDef.syncPerTick,
    },
    { onConflict: "user_id" }
  );
  if (error) {
    throw new Error(error.message);
  }

  const signup =
    metadata?.signup && typeof metadata.signup === "object"
      ? { ...(metadata.signup as Record<string, unknown>) }
      : {};
  signup.trialStartedAt = new Date().toISOString();

  const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...metadata,
      signup,
    },
  });
  if (metaError) {
    console.error("[billing/trial] metadata update failed", metaError.message);
  }

  return { status: "started", plan: intent.plan };
}
