import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { errorFingerprint } from "./fingerprint";

describe("errorFingerprint", () => {
  it("is stable for same input", () => {
    const a = errorFingerprint({ message: "Test 123", route: "/dashboard", source: "client" });
    const b = errorFingerprint({ message: "Test 456", route: "/dashboard", source: "client" });
    assert.equal(a, b);
  });

  it("differs by route", () => {
    const a = errorFingerprint({ message: "x", route: "/a", source: "client" });
    const b = errorFingerprint({ message: "x", route: "/b", source: "client" });
    assert.notEqual(a, b);
  });
});
