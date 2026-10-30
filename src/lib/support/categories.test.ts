import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getSupportCategoryLabel, SUPPORT_CATEGORY_LABELS } from "./categories";

describe("support categories", () => {
  it("labels billing in Turkish", () => {
    assert.equal(SUPPORT_CATEGORY_LABELS.billing, "Fatura / abonelik");
    assert.equal(getSupportCategoryLabel("billing"), "Fatura / abonelik");
  });

  it("falls back for unknown category", () => {
    assert.equal(getSupportCategoryLabel("custom"), "custom");
  });
});
