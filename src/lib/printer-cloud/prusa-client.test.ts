import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapPrusaPrinterState, normalizePrusaTelemetry } from "./prusa-client";

describe("prusa-client", () => {
  it("maps printer states", () => {
    assert.equal(mapPrusaPrinterState("PRINTING"), "printing");
    assert.equal(mapPrusaPrinterState("PAUSED"), "paused");
    assert.equal(mapPrusaPrinterState("OFFLINE"), "offline");
    assert.equal(mapPrusaPrinterState("ERROR"), "error");
  });

  it("normalizes printing job telemetry", () => {
    const t = normalizePrusaTelemetry(
      {
        uuid: "abc",
        printer_state: "PRINTING",
        job_info: {
          display_name: "vase.gcode",
          progress: 55,
          time_printing: 120,
        },
      },
      "abc"
    );
    assert.equal(t.printerState, "printing");
    assert.equal(t.progressPercent, 55);
    assert.equal(t.jobName, "vase.gcode");
    assert.equal(t.printTimeSeconds, 120);
    assert.equal(t.connectionStatus, "connected");
  });
});
