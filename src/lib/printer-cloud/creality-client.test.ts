import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapCrealityPrintState, normalizeCrealityTelemetry } from "./creality-client";

describe("creality-client", () => {
  it("maps print states", () => {
    assert.equal(mapCrealityPrintState(1, null, true), "printing");
    assert.equal(mapCrealityPrintState(4, null, true), "paused");
    assert.equal(mapCrealityPrintState(2, null, true), "idle");
    assert.equal(mapCrealityPrintState(undefined, null, false), "offline");
  });

  it("normalizes printing telemetry from iot snapshot", () => {
    const t = normalizeCrealityTelemetry(
      "26672028002993",
      "K1 Atölye",
      { printProgress: 42, printJobTime: 120, print: 1 },
      {
        printInfo: { deviceName: "26672028002993", printState: 1 },
        gcodeInfo: { name: "vase.gcode" },
      },
      true
    );
    assert.equal(t.printerState, "printing");
    assert.equal(t.progressPercent, 42);
    assert.equal(t.jobName, "vase.gcode");
    assert.equal(t.printTimeSeconds, 120);
  });
});
