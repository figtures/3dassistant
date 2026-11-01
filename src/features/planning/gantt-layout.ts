import {
  addMinutes,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { tr } from "date-fns/locale";
import {
  formatPlanningDayMonth,
  formatPlanningWeekdayShort,
} from "@/lib/format";

export type GanttZoom = "day" | "week" | "month";

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
/** Süre yoksa en az bir tam gün göster. */
export const DEFAULT_JOB_DURATION_MINUTES = 24 * 60;

export function resolveJobDurationMinutes(
  duration: number | null | undefined
): number {
  if (duration != null && duration > 0) return duration;
  return DEFAULT_JOB_DURATION_MINUTES;
}

export function jobTimeRange(
  jobDate: string,
  durationMinutes: number | null | undefined
): { startMs: number; endMs: number } {
  const start = parseISO(jobDate.slice(0, 10));
  const startMs = start.getTime();
  const mins = resolveJobDurationMinutes(durationMinutes);
  return { startMs, endMs: startMs + mins * MS_PER_MINUTE };
}

export type GanttColumn = {
  id: string;
  label: string;
  sublabel?: string;
  startMs: number;
  endMs: number;
  isToday?: boolean;
};

export type GanttBarLayout = {
  leftPercent: number;
  widthPercent: number;
};

export function layoutBarOnTimeline(
  range: { startMs: number; endMs: number },
  timelineStartMs: number,
  timelineEndMs: number,
  minWidthPercent = 0.35
): GanttBarLayout | null {
  const span = timelineEndMs - timelineStartMs;
  if (span <= 0) return null;
  if (range.endMs <= timelineStartMs || range.startMs >= timelineEndMs) {
    return null;
  }
  const clippedStart = Math.max(range.startMs, timelineStartMs);
  const clippedEnd = Math.min(range.endMs, timelineEndMs);
  const leftPercent = ((clippedStart - timelineStartMs) / span) * 100;
  const widthPercent = Math.max(
    minWidthPercent,
    ((clippedEnd - clippedStart) / span) * 100
  );
  return { leftPercent, widthPercent };
}

export function todayMarkerPercent(
  todayIso: string,
  timelineStartMs: number,
  timelineEndMs: number
): number | null {
  const span = timelineEndMs - timelineStartMs;
  if (span <= 0) return null;
  const todayStart = parseISO(todayIso.slice(0, 10)).getTime();
  if (todayStart < timelineStartMs || todayStart >= timelineEndMs) return null;
  return ((todayStart + MS_PER_DAY / 2 - timelineStartMs) / span) * 100;
}

export function buildDayColumns(
  dates: string[],
  todayIso: string
): GanttColumn[] {
  return dates.map((date) => {
    const startMs = parseISO(date.slice(0, 10)).getTime();
    return {
      id: date,
      label: formatPlanningDayMonth(date),
      sublabel: formatPlanningWeekdayShort(date),
      startMs,
      endMs: startMs + MS_PER_DAY,
      isToday: date === todayIso,
    };
  });
}

function uniqueSorted<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

export function buildWeekColumns(
  dates: string[],
  todayIso: string
): GanttColumn[] {
  const weekStarts = uniqueSorted(dates, (d) => {
    const day = parseISO(d.slice(0, 10));
    return format(startOfWeek(day, { locale: tr }), "yyyy-MM-dd");
  }).map((d) => parseISO(d.slice(0, 10)));

  return weekStarts.map((weekStart) => {
    const startMs = startOfWeek(weekStart, { locale: tr }).getTime();
    const endMs = endOfWeek(weekStart, { locale: tr }).getTime() + 1;
    const id = format(weekStart, "yyyy-'W'II", { locale: tr });
    const todayMs = parseISO(todayIso.slice(0, 10)).getTime();
    const isToday = todayMs >= startMs && todayMs < endMs;
    return {
      id,
      label: format(weekStart, "d MMM", { locale: tr }),
      sublabel: `Hafta ${format(weekStart, "II", { locale: tr })}`,
      startMs,
      endMs,
      isToday,
    };
  });
}

export function buildMonthColumns(
  dates: string[],
  todayIso: string
): GanttColumn[] {
  const monthStarts = uniqueSorted(dates, (d) =>
    format(startOfMonth(parseISO(d.slice(0, 10))), "yyyy-MM")
  ).map((ym) => parseISO(`${ym}-01`));

  return monthStarts.map((monthStart) => {
    const startMs = startOfMonth(monthStart).getTime();
    const endMs = endOfMonth(monthStart).getTime() + 1;
    const id = format(monthStart, "yyyy-MM");
    const todayMs = parseISO(todayIso.slice(0, 10)).getTime();
    const isToday = todayMs >= startMs && todayMs < endMs;
    return {
      id,
      label: format(monthStart, "MMMM", { locale: tr }),
      sublabel: format(monthStart, "yyyy", { locale: tr }),
      startMs,
      endMs,
      isToday,
    };
  });
}

export function buildGanttColumns(
  zoom: GanttZoom,
  dates: string[],
  todayIso: string
): GanttColumn[] {
  if (dates.length === 0) return [];
  switch (zoom) {
    case "week":
      return buildWeekColumns(dates, todayIso);
    case "month":
      return buildMonthColumns(dates, todayIso);
    default:
      return buildDayColumns(dates, todayIso);
  }
}

export function timelineBounds(columns: GanttColumn[]): {
  startMs: number;
  endMs: number;
} | null {
  if (columns.length === 0) return null;
  return {
    startMs: columns[0]!.startMs,
    endMs: columns[columns.length - 1]!.endMs,
  };
}

/** İşin görünür aralıkla kesişip kesişmediği. */
export function jobIntersectsTimeline(
  jobDate: string,
  durationMinutes: number | null | undefined,
  timelineStartMs: number,
  timelineEndMs: number
): boolean {
  const range = jobTimeRange(jobDate, durationMinutes);
  return range.endMs > timelineStartMs && range.startMs < timelineEndMs;
}

export function formatJobRangeLabel(
  jobDate: string,
  durationMinutes: number | null | undefined
): string {
  const start = parseISO(jobDate.slice(0, 10));
  const end = addMinutes(start, resolveJobDurationMinutes(durationMinutes));
  const sameDay =
    format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd");
  if (sameDay) {
    return `${format(start, "d MMM yyyy", { locale: tr })} · ${format(end, "HH:mm", { locale: tr })}`;
  }
  return `${format(start, "d MMM", { locale: tr })} – ${format(end, "d MMM yyyy", { locale: tr })}`;
}

export const GANTT_COLUMN_WIDTH: Record<GanttZoom, number> = {
  day: 96,
  week: 128,
  month: 160,
};
