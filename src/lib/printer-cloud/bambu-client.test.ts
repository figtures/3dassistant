import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapBambuPrintStatus, normalizeBambuTelemetry } from "./bambu-client";

describe("bambu-client", () => {
  it("maps print status", () => {
    assert.equal(mapBambuPrintStatus("RUNNING", true), "printing");
    assert.equal(mapBambuPrintStatus("SUCCESS", true), "idle");
    assert.equal(mapBambuPrintStatus("SUCCESS", false), "offline");
  });

  it("normalizes idle device", () => {
    const t = normalizeBambuTelemetry(
      { dev_id: "abc", online: true, print_status: "SUCCESS", name: "X1" },
      null,
      "abc"
    );
    assert.equal(t.printerState, "idle");
    assert.equal(t.connectionStatus, "connected");
  });
});
