import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildExportMatrix } from "@/lib/export/build-matrix";
import { formatExportCell } from "@/lib/export/format-cell";
import { matrixToCsv } from "@/lib/export/to-csv";
import { matrixToXlsxBuffer } from "@/lib/export/to-xlsx";

describe("formatExportCell", () => {
  it("biçimlendirir para tr-TR", () => {
    const formatted = formatExportCell(1234.5, "currency");
    assert.match(formatted, /1\.234,50/);
    assert.match(formatted, /₺|TL/);
  });

  it("Türkçe tarih kısa biçim", () => {
    const formatted = formatExportCell("2026-10-26", "date");
    assert.match(formatted, /26/);
    assert.match(formatted, /2026/);
  });
});

describe("matrixToCsv", () => {
  it("UTF-8 BOM ekler ve Türkçe karakterleri korur", () => {
    const csv = matrixToCsv({
      headers: ["Ad"],
      rows: [["Şükrü Öğretmen"]],
    });
    assert.ok(csv.startsWith("\uFEFF"));
    assert.ok(csv.includes("Şükrü Öğretmen"));
  });

  it("virgül ve tırnak kaçışı", () => {
    const csv = matrixToCsv({
      headers: ["Not"],
      rows: [['Merhaba, "dünya"']],
    });
    assert.ok(csv.includes('"Merhaba, ""dünya"""'));
  });
});

describe("matrixToXlsxBuffer", () => {
  it("xlsx buffer üretir", async () => {
    const buffer = await matrixToXlsxBuffer("Test", {
      headers: ["A"],
      rows: [["1"]],
    });
    assert.ok(buffer.byteLength > 0);
  });
});

describe("buildExportMatrix", () => {
  it("sütun başlıklarını ve satırları hizalar", () => {
    const matrix = buildExportMatrix(
      [{ name: "Ayşe" }],
      [{ id: "name", header: "Ad", getValue: (r) => r.name }]
    );
    assert.deepEqual(matrix.headers, ["Ad"]);
    assert.deepEqual(matrix.rows, [["Ayşe"]]);
  });
});
