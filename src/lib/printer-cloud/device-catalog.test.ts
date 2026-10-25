import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  catalogForVendor,
  findCatalogDevice,
  resolveVendorModel,
} from "./device-catalog";

describe("device-catalog", () => {
  it("resolves Bambu aliases without dropping unknown models", () => {
    assert.equal(resolveVendorModel("bambu", "X1C"), "X1 Carbon");
    assert.equal(resolveVendorModel("bambu", "A1-mini"), "A1 mini");
    assert.equal(resolveVendorModel("bambu", "Yeni Seri ZX"), "Yeni Seri ZX");
    assert.equal(findCatalogDevice("bambu", "H2D")?.family, "H2");
    assert.equal(resolveVendorModel("bambu", "N6"), "X2D");
    assert.equal(findCatalogDevice("bambu", "Bambu Lab X2D")?.family, "X2");
  });

  it("covers a wide Creality workshop set", () => {
    assert.ok(catalogForVendor("creality").length >= 18);
    assert.equal(resolveVendorModel("creality", "K1 Max"), "K1 Max");
    assert.equal(resolveVendorModel("creality", "ender3 v3 ke"), "Ender-3 V3 KE");
    assert.equal(resolveVendorModel("creality", "K2-Plus"), "K2 Plus");
  });
});
