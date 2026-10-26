import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readableTextColor, relativeLuminance } from "@/lib/color-contrast";

describe("color-contrast", () => {
  it("relativeLuminance orders light before dark", () => {
    assert.ok(relativeLuminance("#ffffff") > relativeLuminance("#000000"));
  });

  it("readableTextColor picks dark text on light backgrounds", () => {
    assert.equal(readableTextColor("#ffffff"), "#1a0d05");
    assert.equal(readableTextColor("#fff"), "#1a0d05");
  });

  it("readableTextColor picks light text on dark backgrounds", () => {
    assert.equal(readableTextColor("#1a1a1a"), "#ededef");
    assert.equal(readableTextColor("#000"), "#ededef");
  });
});
