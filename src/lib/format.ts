import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";

/** Tam tarih — örn. 26 Ekim 2026 */
export function formatDate(dateStr: string | Date): string {
  const d = typeof dateStr === "string" ? parseISO(dateStr.slice(0, 10)) : dateStr;
  return format(d, "d MMMM yyyy", { locale: tr });
}

/** Kısa tarih — örn. 26 Eki 2026 */
export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr.slice(0, 10)), "d MMM yyyy", { locale: tr });
}

export { formatCurrency } from "@/lib/utils";
