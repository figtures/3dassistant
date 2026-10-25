"use client";

import { useMemo } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
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
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  in_progress: "Devam",
  completed: "Tamam",
  cancelled: "İptal",
};

interface DeliveryCalendarProps {
  jobs: Job[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onSelectJob: (job: Job) => void;
}

export function DeliveryCalendar({
  jobs,
  currentMonth,
  onMonthChange,
  onSelectJob,
}: DeliveryCalendarProps) {

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
      const key = job.delivery_date;
      const list = map.get(key) ?? [];
      list.push(job);
      map.set(key, list);
    }
    return map;
  }, [jobs]);

  const today = startOfDay(new Date());
  const overdueCount = jobs.filter(
    (j) =>
      j.delivery_date &&
      j.status !== "completed" &&
      j.status !== "cancelled" &&
      startOfDay(parseISO(j.delivery_date)) < today
  ).length;

  function isOverdue(job: Job) {
    if (!job.delivery_date) return false;
    if (job.status === "completed" || job.status === "cancelled") return false;
    return startOfDay(parseISO(job.delivery_date)) < today;
  }

  return (
    <div className="glass-card overflow-hidden rounded-2xl border border-zinc-800/80">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
            aria-label="Önceki ay"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[160px] text-center text-lg font-semibold capitalize text-zinc-100">
            {format(currentMonth, "MMMM yyyy", { locale: tr })}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            aria-label="Sonraki ay"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {overdueCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {overdueCount} geciken iş
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => onMonthChange(new Date())}>
            Bugün
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-zinc-800/60 bg-zinc-900/40">
        {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((day) => (
          <div
            key={day}
            className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayJobs = jobsByDate.get(dateKey) ?? [];
          const inMonth = isSameMonth(day, currentMonth);
          const todayCell = isToday(day);

          return (
            <div
              key={dateKey}
              className={cn(
                "min-h-[100px] border-b border-r border-zinc-800/40 p-1.5 sm:min-h-[120px] sm:p-2",
                !inMonth && "bg-zinc-950/50",
                todayCell && "bg-sky-500/5 ring-1 ring-inset ring-sky-500/20"
              )}
            >
              <div
                className={cn(
                  "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  todayCell
                    ? "bg-sky-500 text-white"
                    : inMonth
                      ? "text-zinc-300"
                      : "text-zinc-600"
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
                        ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/25"
                        : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/80"
                    )}
                    style={{
                      borderLeft: `3px solid ${job.cell_color ?? "#3b82f6"}`,
                    }}
                  >
                    <span className="truncate font-medium">
                      {job.title ?? "İsimsiz"}
                    </span>
                  </button>
                ))}
                {dayJobs.length > 3 && (
                  <p className="px-1 text-[10px] text-zinc-500">
                    +{dayJobs.length - 3} daha
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 border-t border-zinc-800/60 px-4 py-3 text-[11px] text-zinc-500 sm:px-6">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background:
                  key === "pending"
                    ? "#f59e0b"
                    : key === "in_progress"
                      ? "#3b82f6"
                      : key === "completed"
                        ? "#22c55e"
                        : "#ef4444",
              }}
            />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-red-400">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Geciken
        </span>
      </div>
    </div>
  );
}
