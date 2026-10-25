import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("telemetry-history", () => {
  it("module exports", async () => {
    const mod = await import("./telemetry-history");
    assert.equal(typeof mod.maybeRecordTelemetrySnapshot, "function");
    assert.equal(typeof mod.fetchTelemetryHistory, "function");
  });
});
