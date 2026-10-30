import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONNECT_VENDORS,
  methodsForVendor,
  vendorToPrinterCloudVendor,
  isMethodAvailable,
} from "./methods";

describe("methodsForVendor", () => {
  it("lists cloud first for Bambu and Creality", () => {
    const bambu = methodsForVendor("bambu");
    assert.equal(bambu[0]?.id, "cloud");
    assert.equal(bambu.some((m) => m.id === "bridge"), true);
    assert.equal(bambu.some((m) => m.id === "manual"), true);

    const creality = methodsForVendor("creality");
    assert.equal(creality[0]?.id, "cloud");
  });

  it("Prusa has bridge but no cloud", () => {
    const prusa = methodsForVendor("prusa");
    assert.equal(
      prusa.some((m) => m.id === "cloud"),
      false
    );
    assert.equal(prusa[0]?.id, "bridge");
  });

  it("covers every connect vendor", () => {
    for (const v of CONNECT_VENDORS) {
      const methods = methodsForVendor(v);
      assert.ok(methods.length >= 2);
      assert.ok(methods.some((m) => m.id === "manual"));
    }
  });
});

describe("vendorToPrinterCloudVendor", () => {
  it("maps cloud-capable vendors", () => {
    assert.equal(vendorToPrinterCloudVendor("bambu"), "bambu");
    assert.equal(vendorToPrinterCloudVendor("creality"), "creality");
    assert.equal(vendorToPrinterCloudVendor("prusa"), null);
  });
});

describe("isMethodAvailable", () => {
  it("locks cloud when plan disallows monitoring", () => {
    const cloud = methodsForVendor("bambu")[0]!;
    assert.equal(isMethodAvailable(cloud, false), false);
    assert.equal(isMethodAvailable(cloud, true), true);
    const manual = methodsForVendor("bambu").find((m) => m.id === "manual")!;
    assert.equal(isMethodAvailable(manual, false), true);
  });
});
