import { formatExportCell } from "@/lib/export/format-cell";
import type { ExportColumn } from "@/lib/export/types";

export function buildExportMatrix<T>(
  rows: T[],
  columns: ExportColumn<T>[]
): { headers: string[]; rows: string[][] } {
  const headers = columns.map((c) => c.header);
  const matrix = rows.map((row) =>
    columns.map((col) =>
      formatExportCell(col.getValue(row), col.kind ?? "text")
    )
  );
  return { headers, rows: matrix };
}

export function filterExportColumns<T>(
  columns: ExportColumn<T>[],
  visibleColumnIds?: readonly string[]
): ExportColumn<T>[] {
  if (!visibleColumnIds?.length) return columns;
  const allowed = new Set(visibleColumnIds);
  return columns.filter((c) => allowed.has(c.id));
}
