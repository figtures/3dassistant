import type { ExportMatrix } from "@/lib/export/types";

export async function matrixToXlsxBuffer(
  sheetName: string,
  matrix: ExportMatrix
): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([matrix.headers, ...matrix.rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

export async function downloadXlsx(
  filename: string,
  sheetName: string,
  matrix: ExportMatrix
): Promise<void> {
  const buffer = await matrixToXlsxBuffer(sheetName, matrix);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Sunucu yanıtı için XLSX bayt dizisi. */
export async function matrixToXlsxBytes(
  sheetName: string,
  matrix: ExportMatrix
): Promise<Uint8Array> {
  const buffer = await matrixToXlsxBuffer(sheetName, matrix);
  return new Uint8Array(buffer);
}
