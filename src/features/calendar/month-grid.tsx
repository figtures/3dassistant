"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { tr } from "date-fns/locale";
import type { Job } from "@/types/database";
import { Button } from "@/components/ds";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] as const;

const STATUS_LEGEND: Array<{ key: string; label: string; color: string }> = [
  { key: "pending", label: "Bekliyor", color: "#f59e0b" },
  { key: "in_progress", label: "Devam", color: "#3b82f6" },
  { key: "completed", label: "Tamam", color: "#22c55e" },
  { key: "cancelled", label: "İptal", color: "#ef4444" },
];

export type MonthGridProps = {
  jobs: Job[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onSelectJob: (job: Job) => void;
};

export function MonthGrid({
  jobs,
  currentMonth,
  onMonthChange,
  onSelectJob,
}: MonthGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusedDateKey, setFocusedDateKey] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const jobsByDate = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const job of jobs) {
      if (!job.delivery_date) continue;
      const list = map.get(job.delivery_date) ?? [];
      list.push(job);
      map.set(job.delivery_date, list);
    }
    return map;
  }, [jobs]);

  const today = startOfDay(new Date());

  const overdueCount = useMemo(
    () =>
      jobs.filter(
        (j) =>
          j.delivery_date &&
          j.status !== "completed" &&
          j.status !== "cancelled" &&
          startOfDay(parseISO(j.delivery_date)) < today
      ).length,
    [jobs, today]
  );

  const isOverdue = useCallback(
    (job: Job) => {
      if (!job.delivery_date) return false;
      if (job.status === "completed" || job.status === "cancelled") return false;
      return startOfDay(parseISO(job.delivery_date)) < today;
    },
    [today]
  );

  const dayIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    calendarDays.forEach((day, index) => {
      map.set(format(day, "yyyy-MM-dd"), index);
    });
    return map;
  }, [calendarDays]);

  const moveFocus = useCallback(
    (delta: number) => {
      const currentIndex = dayIndexByKey.get(focusedDateKey) ?? 0;
      const nextIndex = Math.max(0, Math.min(calendarDays.length - 1, currentIndex + delta));
      const nextKey = format(calendarDays[nextIndex], "yyyy-MM-dd");
      setFocusedDateKey(nextKey);
      const cell = gridRef.current?.querySelector<HTMLElement>(`[data-date="${nextKey}"]`);
      cell?.focus();
    },
    [calendarDays, dayIndexByKey, focusedDateKey]
  );

  function handleGridKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        moveFocus(-1);
        break;
      case "ArrowRight":
        e.preventDefault();
        moveFocus(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveFocus(-7);
        break;
      case "ArrowDown":
        e.preventDefault();
        moveFocus(7);
        break;
      case "Home":
        e.preventDefault();
        if (calendarDays.length) {
          const key = format(calendarDays[0], "yyyy-MM-dd");
          setFocusedDateKey(key);
          gridRef.current?.querySelector<HTMLElement>(`[data-date="${key}"]`)?.focus();
        }
        break;
      case "End":
        e.preventDefault();
        if (calendarDays.length) {
          const key = format(calendarDays.at(-1)!, "yyyy-MM-dd");
          setFocusedDateKey(key);
          gridRef.current?.querySelector<HTMLElement>(`[data-date="${key}"]`)?.focus();
        }
        break;
      default:
        break;
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
            aria-label="Önceki ay"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[160px] text-center text-lg font-semibold capitalize text-foreground">
            {format(currentMonth, "MMMM yyyy", { locale: tr })}
          </h2>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            aria-label="Sonraki ay"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {overdueCount > 0 ? (
            <span className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {overdueCount} geciken iş
            </span>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => onMonthChange(new Date())}>
            Bugün
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEKDAY_LABELS.map((day) => (
          <div
            key={day}
            className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={`Teslim takvimi, ${format(currentMonth, "MMMM yyyy", { locale: tr })}`}
        className="grid grid-cols-7 outline-none"
        onKeyDown={handleGridKeyDown}
      >
        {calendarDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayJobs = jobsByDate.get(dateKey) ?? [];
          const inMonth = isSameMonth(day, currentMonth);
          const todayCell = isToday(day);
          const focused = focusedDateKey === dateKey;

          return (
            <div
              key={dateKey}
              role="gridcell"
              data-date={dateKey}
              tabIndex={focused ? 0 : -1}
              aria-label={`${format(day, "d MMMM yyyy", { locale: tr })}, ${dayJobs.length} sipariş`}
              className={cn(
                "min-h-[100px] border-b border-r border-border p-1.5 outline-none sm:min-h-[120px] sm:p-2",
                "focus-visible:shadow-[var(--focus-ring)]",
                !inMonth && "bg-muted/20",
                todayCell && "bg-primary/5 ring-1 ring-inset ring-primary/20"
              )}
              onFocus={() => setFocusedDateKey(dateKey)}
            >
              <div
                className={cn(
                  "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  todayCell
                    ? "bg-primary text-primary-foreground"
                    : inMonth
                      ? "text-foreground"
                      : "text-muted-foreground"
                )}
              >
                {format(day, "d")}
              </div>

              <div className="space-y-0.5">
                {dayJobs.slice(0, 3).map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => onSelectJob(job)}
                    className={cn(
                      "group flex w-full items-start gap-1 rounded-md px-1.5 py-0.5 text-left text-[10px] leading-tight transition-colors sm:text-[11px]",
                      isOverdue(job)
                        ? "bg-destructive/15 text-destructive ring-1 ring-destructive/30 hover:bg-destructive/25"
                        : "bg-muted/80 text-foreground hover:bg-accent"
                    )}
                    style={{
                      borderLeft: `3px solid ${job.cell_color ?? "#3b82f6"}`,
                    }}
                  >
                    <span className="truncate font-medium">{job.title ?? "İsimsiz"}</span>
                  </button>
                ))}
                {dayJobs.length > 3 ? (
                  <p className="px-1 text-[10px] text-muted-foreground">+{dayJobs.length - 3} daha</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 border-t border-border px-4 py-3 text-[11px] text-muted-foreground sm:px-6">
        {STATUS_LEGEND.map((item) => (
          <span key={item.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-destructive">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          Geciken
        </span>
      </div>
    </div>
  );
}
