import { format, getDay, parseISO } from "date-fns";
import { tr } from "date-fns/locale";

const istanbulDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Bugünün tarihi (yyyy-MM-dd), Europe/Istanbul. */
export function todayIsoInIstanbul(): string {
  return istanbulDateFormatter.format(new Date());
}

/** Tam tarih — örn. 26 Ekim 2026 */
export function formatDate(dateStr: string | Date): string {
  const d = typeof dateStr === "string" ? parseISO(dateStr.slice(0, 10)) : dateStr;
  return format(d, "d MMMM yyyy", { locale: tr });
}

/** Kısa tarih — örn. 26 Eki 2026 */
export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr.slice(0, 10)), "d MMM yyyy", { locale: tr });
}

/** Plan sütun başlığı — gün + kısa ay (örn. 12 Eki). */
export function formatPlanningDayMonth(dateStr: string): string {
  return format(parseISO(dateStr.slice(0, 10)), "d MMM", { locale: tr });
}

/** Plan sütun başlığı — haftanın günü kısa (örn. Pzt). tr-TR locale ile ayrı satırda gösterilir. */
export function formatPlanningWeekdayShort(dateStr: string): string {
  return format(parseISO(dateStr.slice(0, 10)), "EEE", { locale: tr });
}

/** Tam gün adı — erişilebilir etiketler için (örn. Pazartesi). */
export function formatPlanningWeekdayLong(dateStr: string): string {
  return format(parseISO(dateStr.slice(0, 10)), "EEEE", { locale: tr });
}

export function isWeekendDate(dateStr: string): boolean {
  const day = getDay(parseISO(dateStr.slice(0, 10)));
  return day === 0 || day === 6;
}

export { formatCurrency } from "@/lib/utils";
