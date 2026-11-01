import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { isStaleUpdate, normalizeSubscription, verifyPaddleSignature } from "./webhook";
import { entitlementsFromSubscription } from "./entitlements";

const SECRET = "pdl_ntfset_test_secret";
const BODY = JSON.stringify({ event_id: "evt_1", event_type: "subscription.created" });

function sign(ts: number, body = BODY, secret = SECRET) {
  return createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex");
}

describe("verifyPaddleSignature", () => {
  const now = 1_760_000_000;

  it("accepts a valid signature", () => {
    const header = `ts=${now};h1=${sign(now)}`;
    assert.equal(verifyPaddleSignature({ rawBody: BODY, header, secret: SECRET, nowSeconds: now }), true);
  });

  it("accepts when any of rotated signatures matches", () => {
    const header = `ts=${now};h1=${sign(now, BODY, "old")};h1=${sign(now)}`;
    assert.equal(verifyPaddleSignature({ rawBody: BODY, header, secret: SECRET, nowSeconds: now }), true);
  });

  it("rejects tampered body", () => {
    const header = `ts=${now};h1=${sign(now)}`;
    assert.equal(
      verifyPaddleSignature({ rawBody: BODY + " ", header, secret: SECRET, nowSeconds: now }),
      false
    );
  });

  it("rejects wrong secret, stale timestamp and malformed header", () => {
    const header = `ts=${now};h1=${sign(now, BODY, "wrong")}`;
    assert.equal(verifyPaddleSignature({ rawBody: BODY, header, secret: SECRET, nowSeconds: now }), false);
    const old = `ts=${now - 3600};h1=${sign(now - 3600)}`;
    assert.equal(verifyPaddleSignature({ rawBody: BODY, header: old, secret: SECRET, nowSeconds: now }), false);
    assert.equal(verifyPaddleSignature({ rawBody: BODY, header: "garbage", secret: SECRET, nowSeconds: now }), false);
    assert.equal(verifyPaddleSignature({ rawBody: BODY, header: null, secret: SECRET, nowSeconds: now }), false);
  });
});

describe("normalizeSubscription", () => {
  const planFor = (id: string | null) =>
    id === "pri_pro" || id === "pri_pro_yearly" ? "pro" : null;
  const base = {
    id: "sub_1",
    status: "active",
    customer_id: "ctm_1",
    custom_data: { user_id: "8abd4e51-7751-42c0-8e07-6cf559eeb534" },
    items: [{ price: { id: "pri_pro" } }],
    current_billing_period: { ends_at: "2026-11-17T00:00:00Z" },
    scheduled_change: { action: "cancel", effective_at: "2026-11-17T00:00:00Z" },
    updated_at: "2026-10-17T00:00:00Z",
  };

  it("maps plan limits from price and keeps cancel schedule", () => {
    const r = normalizeSubscription(base, planFor);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.value.plan_key, "pro");
    assert.equal(r.value.max_machines, 8);
    assert.equal(r.value.cloud_monitoring, true);
    assert.equal(r.value.cancel_at, "2026-11-17T00:00:00Z");
    assert.equal(r.value.custom_user_id, base.custom_data.user_id);
  });

  it("yıllık fiyat kimliği ile plan eşler", () => {
    const r = normalizeSubscription(
      { ...base, items: [{ price: { id: "pri_pro_yearly" } }] },
      planFor
    );
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.value.plan_key, "pro");
  });

  it("rejects unknown prices and statuses, ignores non-uuid user ids", () => {
    assert.equal(normalizeSubscription({ ...base, items: [{ price: { id: "pri_x" } }] }, planFor).ok, false);
    assert.equal(normalizeSubscription({ ...base, status: "weird" }, planFor).ok, false);
    const r = normalizeSubscription({ ...base, custom_data: { user_id: "x' OR 1=1" } }, planFor);
    assert.ok(r.ok && r.value.custom_user_id === null);
  });
});

describe("isStaleUpdate", () => {
  it("detects out-of-order events", () => {
    assert.equal(isStaleUpdate("2026-10-17T10:00:00Z", "2026-10-17T09:00:00Z"), true);
    assert.equal(isStaleUpdate("2026-10-17T09:00:00Z", "2026-10-17T10:00:00Z"), false);
    assert.equal(isStaleUpdate(null, "2026-10-17T10:00:00Z"), false);
  });
});

describe("entitlementsFromSubscription", () => {
  const row = {
    user_id: "u",
    paddle_subscription_id: "sub_1",
    paddle_customer_id: "ctm_1",
    plan_key: "farm" as const,
    status: "active" as const,
    current_period_end: null,
    cancel_at: null,
    max_machines: 40,
    cloud_monitoring: true,
    sync_per_tick: 20,
  };

  it("falls back to free when there is no subscription", () => {
    const e = entitlementsFromSubscription(null);
    assert.equal(e.planKey, "free");
    assert.equal(e.cloudMonitoring, false);
    assert.equal(e.maxMachines, 2);
  });

  it("keeps rights while past_due, drops them when canceled", () => {
    assert.equal(entitlementsFromSubscription({ ...row, status: "past_due" }).planKey, "farm");
    const canceled = entitlementsFromSubscription({ ...row, status: "canceled" });
    assert.equal(canceled.planKey, "free");
    assert.equal(canceled.cloudMonitoring, false);
    assert.equal(canceled.subscription?.status, "canceled");
  });
});
