import { formatDateShort } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";
import type { ExportCellKind } from "@/lib/export/types";

const numberFormatter = new Intl.NumberFormat("tr-TR");

export function formatExportCell(
  value: unknown,
  kind: ExportCellKind = "text"
): string {
  if (value == null || value === "") return "";

  if (kind === "currency") {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n)) return formatCurrency(n);
    return String(value);
  }

  if (kind === "number") {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n)) return numberFormatter.format(n);
    return String(value);
  }

  if (kind === "date") {
    const raw = String(value);
    if (!raw.trim()) return "";
    try {
      return formatDateShort(raw);
    } catch {
      return raw;
    }
  }

  return String(value);
}
