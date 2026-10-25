import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeCrealityLanTelemetry } from "./creality-lan";

describe("creality-lan", () => {
  it("normalizes LAN iot snapshot without cloud print row", () => {
    const t = normalizeCrealityLanTelemetry(
      "26672028002993",
      "K1 Atölye",
      { printProgress: 10, print: 1, gcodeName: "part.gcode" },
      true
    );
    assert.equal(t.printerState, "printing");
    assert.equal(t.progressPercent, 10);
  });
});
