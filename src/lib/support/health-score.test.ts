import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeHealthScore,
  healthBandFromScore,
  sortTenantHealthRows,
  type TenantHealthRow,
} from "./health-score";

const NOW = new Date("2026-10-30T12:00:00.000Z");

function baseInput(overrides: Partial<Parameters<typeof computeHealthScore>[0]> = {}) {
  return {
    lastSignInAt: "2026-10-29T10:00:00.000Z",
    connectedMachineCount: 2,
    totalMachineCount: 3,
    ordersLast7Days: 5,
    ordersLast30Days: 20,
    clientErrorCount7d: 0,
    openSupportTickets: 0,
    planKey: "pro" as const,
    subscriptionStatus: "active",
    lastNpsScore: 9,
    now: NOW,
    ...overrides,
  };
}

describe("healthBandFromScore", () => {
  it("maps thresholds", () => {
    assert.equal(healthBandFromScore(85), "green");
    assert.equal(healthBandFromScore(70), "green");
    assert.equal(healthBandFromScore(55), "yellow");
    assert.equal(healthBandFromScore(40), "yellow");
    assert.equal(healthBandFromScore(15), "red");
  });
});

describe("computeHealthScore", () => {
  it("returns high score for healthy tenant", () => {
    const result = computeHealthScore(baseInput());
    assert.ok(result.score >= 90);
    assert.equal(result.band, "green");
  });

  it("penalizes inactivity and churn signals", () => {
    const result = computeHealthScore(
      baseInput({
        lastSignInAt: "2026-09-01T10:00:00.000Z",
        ordersLast7Days: 0,
        ordersLast30Days: 0,
        connectedMachineCount: 0,
        clientErrorCount7d: 12,
        openSupportTickets: 2,
        subscriptionStatus: "canceled",
        lastNpsScore: 4,
      })
    );
    assert.ok(result.score < 40);
    assert.equal(result.band, "red");
    assert.ok(result.factors.length >= 5);
  });

  it("clamps score to 0–100", () => {
    const result = computeHealthScore(
      baseInput({
        lastSignInAt: null,
        ordersLast30Days: 0,
        totalMachineCount: 5,
        connectedMachineCount: 0,
        clientErrorCount7d: 100,
        openSupportTickets: 5,
        subscriptionStatus: "canceled",
        lastNpsScore: 0,
      })
    );
    assert.equal(result.score, 0);
    assert.equal(result.band, "red");
  });
});

describe("sortTenantHealthRows", () => {
  const rows: TenantHealthRow[] = [
    {
      workspaceId: "a",
      name: "Beta",
      ownerEmail: null,
      lastSignInAt: null,
      connectedMachineCount: 0,
      totalMachineCount: 1,
      ordersLast7Days: 0,
      ordersLast30Days: 0,
      clientErrorCount7d: 0,
      openSupportTickets: 0,
      planKey: "free",
      subscriptionStatus: null,
      lastNpsScore: null,
      lastNpsAt: null,
      uiVersion: null,
      score: 30,
      band: "red",
      factors: [],
    },
    {
      workspaceId: "b",
      name: "Alfa",
      ownerEmail: null,
      lastSignInAt: "2026-10-29T00:00:00.000Z",
      connectedMachineCount: 2,
      totalMachineCount: 2,
      ordersLast7Days: 3,
      ordersLast30Days: 10,
      clientErrorCount7d: 1,
      openSupportTickets: 0,
      planKey: "pro",
      subscriptionStatus: "active",
      lastNpsScore: 10,
      lastNpsAt: null,
      uiVersion: "v2",
      score: 85,
      band: "green",
      factors: [],
    },
  ];

  it("sorts by score ascending (at-risk first)", () => {
    const sorted = sortTenantHealthRows(rows, "score", "asc");
    assert.equal(sorted[0]?.workspaceId, "a");
    assert.equal(sorted[1]?.workspaceId, "b");
  });

  it("sorts by name with Turkish locale", () => {
    const sorted = sortTenantHealthRows(rows, "name", "asc");
    assert.equal(sorted[0]?.name, "Alfa");
  });
});
