import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BRIDGE_VENDORS, BRIDGE_VENDOR_LABELS, parseBridgeVendor } from "./vendors";
import { BRIDGE_LAN_HINTS } from "./vendor-lan-hints";

describe("bridge vendors", () => {
  it("parses extended vendors", () => {
    for (const v of ["anycubic", "elegoo", "flashforge", "snapmaker"] as const) {
      assert.equal(parseBridgeVendor(v), v);
    }
  });

  it("parses discovery vendors (Klipper, OctoPrint, PrusaLink)", () => {
    for (const v of ["klipper", "octoprint", "prusalink"] as const) {
      assert.equal(parseBridgeVendor(v.toUpperCase()), v);
    }
    assert.equal(parseBridgeVendor("ultimaker"), null);
    assert.equal(BRIDGE_VENDORS.length, 9);
  });

  it("has labels and hints for every vendor", () => {
    for (const v of BRIDGE_VENDORS) {
      assert.ok(BRIDGE_VENDOR_LABELS[v]);
      assert.ok(BRIDGE_LAN_HINTS[v].discovery);
    }
  });
});
