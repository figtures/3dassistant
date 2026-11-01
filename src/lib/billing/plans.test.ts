import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { planKeyForPriceId, priceIdForPlan } from "./plans";

const ENV_KEYS = [
  "PADDLE_STARTER_PRICE_ID",
  "PADDLE_PRO_PRICE_ID",
  "PADDLE_FARM_PRICE_ID",
  "PADDLE_STARTER_YEARLY_PRICE_ID",
  "PADDLE_PRO_YEARLY_PRICE_ID",
  "PADDLE_FARM_YEARLY_PRICE_ID",
] as const;

describe("planKeyForPriceId", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
    }
    process.env.PADDLE_STARTER_PRICE_ID = "pri_starter_m";
    process.env.PADDLE_PRO_PRICE_ID = "pri_pro_m";
    process.env.PADDLE_FARM_PRICE_ID = "pri_farm_m";
    process.env.PADDLE_STARTER_YEARLY_PRICE_ID = "pri_starter_y";
    process.env.PADDLE_PRO_YEARLY_PRICE_ID = "pri_pro_y";
    process.env.PADDLE_FARM_YEARLY_PRICE_ID = "pri_farm_y";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("aylık ve yıllık fiyat kimliklerini plana eşler", () => {
    assert.equal(planKeyForPriceId("pri_pro_m"), "pro");
    assert.equal(planKeyForPriceId("pri_pro_y"), "pro");
    assert.equal(planKeyForPriceId("pri_farm_y"), "farm");
    assert.equal(planKeyForPriceId("unknown"), null);
  });

  it("priceIdForPlan yıllık env okur", () => {
    assert.equal(priceIdForPlan("pro", "year"), "pri_pro_y");
    assert.equal(priceIdForPlan("pro", "month"), "pri_pro_m");
  });
});
