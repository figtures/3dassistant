import { createHmac, timingSafeEqual } from "node:crypto";
import { PLANS, type PaidPlanKey, type SubscriptionStatus } from "./plans";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Paddle-Signature: "ts=1671552777;h1=<hex>" — imzalanan içerik "<ts>:<ham gövde>".
 * Anahtar rotasyonunda birden fazla h1 gelebilir.
 */
export function verifyPaddleSignature(input: {
  rawBody: string;
  header: string | null;
  secret: string;
  nowSeconds: number;
  toleranceSeconds?: number;
}): boolean {
  if (!input.header || !input.secret) return false;

  let ts: string | null = null;
  const signatures: string[] = [];
  for (const part of input.header.split(";")) {
    const [k, v] = part.split("=", 2).map((s) => s?.trim());
    if (k === "ts" && v) ts = v;
    if (k === "h1" && v) signatures.push(v);
  }
  if (!ts || signatures.length === 0 || !/^\d+$/.test(ts)) return false;

  const tolerance = input.toleranceSeconds ?? 300;
  if (Math.abs(input.nowSeconds - Number(ts)) > tolerance) return false;

  const expected = createHmac("sha256", input.secret).update(`${ts}:${input.rawBody}`).digest();
  return signatures.some((sig) => {
    if (!/^[0-9a-f]+$/i.test(sig)) return false;
    const given = Buffer.from(sig, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export type PaddleSubscriptionData = {
  id?: string;
  status?: string;
  customer_id?: string;
  custom_data?: Record<string, unknown> | null;
  items?: { price?: { id?: string } | null }[];
  current_billing_period?: { ends_at?: string } | null;
  scheduled_change?: { action?: string; effective_at?: string } | null;
  updated_at?: string;
};

export type NormalizedSubscription = {
  paddle_subscription_id: string;
  paddle_customer_id: string;
  paddle_price_id: string | null;
  plan_key: PaidPlanKey;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at: string | null;
  max_machines: number;
  cloud_monitoring: boolean;
  sync_per_tick: number;
  paddle_updated_at: string | null;
  custom_user_id: string | null;
};

const STATUSES: SubscriptionStatus[] = ["trialing", "active", "past_due", "canceled", "paused"];

export type NormalizeResult =
  | { ok: true; value: NormalizedSubscription }
  | { ok: false; reason: string };

export function normalizeSubscription(
  data: PaddleSubscriptionData,
  planForPrice: (priceId: string | null) => PaidPlanKey | null
): NormalizeResult {
  if (!data.id || !data.customer_id) return { ok: false, reason: "missing_ids" };
  const status = STATUSES.find((s) => s === data.status);
  if (!status) return { ok: false, reason: `unknown_status:${data.status}` };

  const priceId = data.items?.[0]?.price?.id ?? null;
  const planKey = planForPrice(priceId);
  if (!planKey) return { ok: false, reason: `unknown_price:${priceId}` };

  const rawUserId = data.custom_data?.user_id;
  const plan = PLANS[planKey];

  return {
    ok: true,
    value: {
      paddle_subscription_id: data.id,
      paddle_customer_id: data.customer_id,
      paddle_price_id: priceId,
      plan_key: planKey,
      status,
      current_period_end: data.current_billing_period?.ends_at ?? null,
      cancel_at:
        data.scheduled_change?.action === "cancel"
          ? data.scheduled_change.effective_at ?? null
          : null,
      max_machines: plan.maxMachines,
      cloud_monitoring: plan.cloudMonitoring,
      sync_per_tick: plan.syncPerTick,
      paddle_updated_at: data.updated_at ?? null,
      custom_user_id: typeof rawUserId === "string" && UUID_RE.test(rawUserId) ? rawUserId : null,
    },
  };
}

/** Sıra dışı gelen eski olayların yeni durumu ezmemesi için. */
export function isStaleUpdate(
  existingUpdatedAt: string | null | undefined,
  incomingUpdatedAt: string | null
): boolean {
  if (!existingUpdatedAt || !incomingUpdatedAt) return false;
  return new Date(incomingUpdatedAt).getTime() < new Date(existingUpdatedAt).getTime();
}
