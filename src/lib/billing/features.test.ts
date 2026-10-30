import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  minimumPlanForFeature,
  planMeetsFeature,
  suggestedUpgradePlan,
} from "@/lib/billing/features";

describe("billing features", () => {
  it("minimum plans", () => {
    assert.equal(minimumPlanForFeature("cloud_sync"), "pro");
    assert.equal(minimumPlanForFeature("machine_slots"), "starter");
  });

  it("planMeetsFeature", () => {
    assert.equal(planMeetsFeature("free", "cloud_sync"), false);
    assert.equal(planMeetsFeature("pro", "cloud_sync"), true);
    assert.equal(planMeetsFeature("starter", "machine_slots"), true);
  });

  it("suggestedUpgradePlan bumps from free to pro for cloud", () => {
    assert.equal(suggestedUpgradePlan("free", "cloud_sync"), "pro");
    assert.equal(suggestedUpgradePlan("pro", "machine_slots"), "farm");
  });
});
