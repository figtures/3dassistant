import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatBulkDeleteSummary,
  formatBulkSummary,
} from "@/features/orders/bulk-actions";

describe("formatBulkSummary", () => {
  it("tekil güncelleme", () => {
    assert.equal(formatBulkSummary(1, 0, "sipariş"), "1 sipariş güncellendi");
  });

  it("çoğul güncelleme", () => {
    assert.equal(formatBulkSummary(12, 0, "sipariş"), "12 sipariş güncellendi");
  });

  it("atlanan yetki mesajı", () => {
    assert.equal(
      formatBulkSummary(12, 1, "sipariş"),
      "12 sipariş güncellendi, 1 atlandı (yetki)"
    );
  });
});

describe("formatBulkDeleteSummary", () => {
  it("silme özeti", () => {
    assert.equal(formatBulkDeleteSummary(3, 0, "sipariş"), "3 sipariş silindi");
    assert.equal(
      formatBulkDeleteSummary(2, 1, "müşteri"),
      "2 müşteri silindi, 1 atlandı (yetki)"
    );
  });
});
