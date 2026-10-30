import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SAMPLE_CUSTOMER_DEFS,
  SAMPLE_JOB_DEFS,
  SAMPLE_MACHINE_DEFS,
  SAMPLE_MATERIAL_DEFS,
  dateOffsetIso,
  isSampleTagged,
  tagSampleField,
  validateSampleTemplate,
} from "./sample-data";

describe("sample-data template", () => {
  it("şablon sayıları backlog ile uyumlu", () => {
    assert.deepEqual(validateSampleTemplate(), []);
    assert.equal(SAMPLE_MACHINE_DEFS.length, 2);
    assert.equal(SAMPLE_MATERIAL_DEFS.length, 3);
    assert.equal(SAMPLE_CUSTOMER_DEFS.length, 3);
    assert.equal(SAMPLE_JOB_DEFS.length, 8);
  });

  it("etiket yardımcıları tutarlı", () => {
    const tagged = tagSampleField("test");
    assert.ok(isSampleTagged(tagged));
    assert.equal(isSampleTagged("normal metin"), false);
  });

  it("tarih ofseti YYYY-MM-DD üretir", () => {
    assert.match(dateOffsetIso(0), /^\d{4}-\d{2}-\d{2}$/);
  });
});
