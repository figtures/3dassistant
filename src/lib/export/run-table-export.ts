import {
  buildExportMatrix,
  filterExportColumns,
} from "@/lib/export/build-matrix";
import {
  SERVER_EXPORT_ROW_THRESHOLD,
  type ExportFormat,
  type ExportTableId,
} from "@/lib/export/constants";
import { downloadCsv, matrixToCsv } from "@/lib/export/to-csv";
import { downloadXlsx } from "@/lib/export/to-xlsx";
import type { ExportColumn } from "@/lib/export/types";

export type RunTableExportOptions<T> = {
  tableId: ExportTableId;
  format: ExportFormat;
  filenameBase: string;
  sheetName: string;
  totalCount: number;
  serverQuery: string;
  columns: ExportColumn<T>[];
  visibleColumnIds?: readonly string[];
  fetchRows: () => Promise<T[]>;
};

function exportFilename(base: string, format: ExportFormat): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${base}_${date}.${format}`;
}

async function downloadViaServer(
  tableId: ExportTableId,
  format: ExportFormat,
  query: string,
  filenameBase: string,
  visibleColumnIds?: readonly string[]
): Promise<void> {
  const params = new URLSearchParams(query);
  params.set("format", format);
  if (visibleColumnIds?.length) {
    params.set("columns", visibleColumnIds.join(","));
  }
  const res = await fetch(`/api/export/${tableId}?${params.toString()}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Dışa aktarma başarısız");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const ext = format === "csv" ? "csv" : "xlsx";
  anchor.download = exportFilename(filenameBase, ext as ExportFormat);
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function runTableExport<T>(
  options: RunTableExportOptions<T>
): Promise<void> {
  const columns = filterExportColumns(
    options.columns,
    options.visibleColumnIds
  );

  if (options.totalCount > SERVER_EXPORT_ROW_THRESHOLD) {
    await downloadViaServer(
      options.tableId,
      options.format,
      options.serverQuery,
      options.filenameBase,
      options.visibleColumnIds
    );
    return;
  }

  const rows = await options.fetchRows();
  const matrix = buildExportMatrix(rows, columns);
  const filename = exportFilename(options.filenameBase, options.format);

  if (options.format === "csv") {
    downloadCsv(filename, matrixToCsv(matrix));
    return;
  }

  await downloadXlsx(filename, options.sheetName, matrix);
}
