"use client";

import { useState } from "react";
import { Button } from "@/components/ds/button";
import type { ExportFormat } from "@/lib/export/constants";
import { runTableExport } from "@/lib/export/run-table-export";
import type { ExportColumn } from "@/lib/export/types";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export type TableExportMenuProps<T> = {
  tableId: "orders" | "customers";
  filenameBase: string;
  sheetName: string;
  totalCount: number;
  serverQuery: string;
  columns: ExportColumn<T>[];
  visibleColumnIds?: readonly string[];
  fetchRows: () => Promise<T[]>;
  disabled?: boolean;
  className?: string;
};

export function TableExportMenu<T>({
  tableId,
  filenameBase,
  sheetName,
  totalCount,
  serverQuery,
  columns,
  visibleColumnIds,
  fetchRows,
  disabled,
  className,
}: TableExportMenuProps<T>) {
  const [pending, setPending] = useState<ExportFormat | null>(null);

  async function handleExport(format: ExportFormat) {
    if (totalCount === 0) {
      toast.error("Dışa aktarılacak satır yok");
      return;
    }
    setPending(format);
    try {
      await runTableExport({
        tableId,
        format,
        filenameBase,
        sheetName,
        totalCount,
        serverQuery,
        columns,
        visibleColumnIds,
        fetchRows,
      });
      toast.success("Dışa aktarma indirildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dışa aktarma başarısız");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={className}>
      <div
        className="inline-flex rounded-lg border border-border bg-surface-inset p-0.5"
        role="group"
        aria-label="Dışa aktar"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || pending != null}
          loading={pending === "csv"}
          onClick={() => void handleExport("csv")}
        >
          <Download className="size-4" aria-hidden />
          CSV
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || pending != null}
          loading={pending === "xlsx"}
          onClick={() => void handleExport("xlsx")}
        >
          <FileSpreadsheet className="size-4" aria-hidden />
          Excel
        </Button>
      </div>
    </div>
  );
}
