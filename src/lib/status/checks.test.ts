import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateChecksToDailyBars,
  buildServiceSnapshots,
  dayStateFromChecks,
  overallPageStatus,
  uptimePercentFromDailyBars,
  type StatusCheckRow,
} from "./checks";

const NOW = new Date("2026-10-30T15:00:00.000Z");

function row(
  service: StatusCheckRow["service"],
  ok: boolean,
  checkedAt: string
): StatusCheckRow {
  return { service, ok, latency_ms: 10, checked_at: checkedAt };
}

describe("dayStateFromChecks", () => {
  it("classifies empty, all ok, all fail, mixed", () => {
    assert.equal(dayStateFromChecks([]), "unknown");
    assert.equal(dayStateFromChecks([row("app", true, "2026-10-30T10:00:00Z")]), "operational");
    assert.equal(dayStateFromChecks([row("app", false, "2026-10-30T10:00:00Z")]), "down");
    assert.equal(
      dayStateFromChecks([
        row("app", true, "2026-10-30T10:00:00Z"),
        row("app", false, "2026-10-30T11:00:00Z"),
      ]),
      "degraded"
    );
  });
});

describe("aggregateChecksToDailyBars", () => {
  it("fills 90 days and buckets by UTC date", () => {
    const bars = aggregateChecksToDailyBars(
      [
        row("app", true, "2026-10-29T23:00:00Z"),
        row("app", false, "2026-10-30T08:00:00Z"),
      ],
      3,
      NOW
    );
    assert.equal(bars.length, 3);
    assert.equal(bars[2]!.date, "2026-10-30");
    assert.equal(bars[2]!.state, "down");
    assert.equal(bars[2]!.totalChecks, 1);
  });
});

describe("uptimePercentFromDailyBars", () => {
  it("ignores unknown days", () => {
    const pct = uptimePercentFromDailyBars([
      { date: "2026-10-28", state: "operational", totalChecks: 1, failedChecks: 0 },
      { date: "2026-10-29", state: "unknown", totalChecks: 0, failedChecks: 0 },
      { date: "2026-10-30", state: "down", totalChecks: 1, failedChecks: 1 },
    ]);
    assert.equal(pct, 50);
  });
});

describe("buildServiceSnapshots", () => {
  it("builds per-service latest and bars", () => {
    const snapshots = buildServiceSnapshots(
      [row("email", true, "2026-10-30T12:00:00Z")],
      NOW,
      2
    );
    const email = snapshots.find((s) => s.service === "email");
    assert.ok(email);
    assert.equal(email!.currentOk, true);
    assert.equal(email!.dailyBars.length, 2);
  });
});

describe("overallPageStatus", () => {
  it("aggregates current service states", () => {
    const base = buildServiceSnapshots([], NOW, 1);
    assert.equal(overallPageStatus(base), "unknown");

    const mixed = base.map((s) =>
      s.service === "app" ? { ...s, currentOk: true } : { ...s, currentOk: false }
    );
    assert.equal(overallPageStatus(mixed), "degraded");
  });
});
