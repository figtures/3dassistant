"use client";

import type { Job, Machine } from "@/types/database";
import {
  formatPlanningDayMonth,
  formatPlanningWeekdayShort,
  isWeekendDate,
  todayIsoInIstanbul,
} from "@/lib/format";
import { deriveMachineState } from "@/lib/machine-state";
import { PlanCellAdd, PlanJobBlock } from "@/features/planning/plan-cell";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ds";
import { cn } from "@/lib/utils";

export type DayListMobileProps = {
  dates: string[];
  selectedDate: string;
  onSelectedDateChange: (date: string) => void;
  machines: Machine[];
  jobMap: Map<string, Job[]>;
  onCellOpen: (machine: Machine, date: string, job: Job | null) => void;
};

export function DayListMobile({
  dates,
  selectedDate,
  onSelectedDateChange,
  machines,
  jobMap,
  onCellOpen,
}: DayListMobileProps) {
  const today = todayIsoInIstanbul();

  return (
    <div className="space-y-4 lg:hidden">
      <div
        className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]"
        role="tablist"
        aria-label="Gün seçici"
      >
        {dates.map((date) => {
          const selected = date === selectedDate;
          const isToday = date === today;
          return (
            <button
              key={date}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelectedDateChange(date)}
              className={cn(
                "flex shrink-0 flex-col items-center rounded-lg border px-3 py-2 text-center transition-colors",
                "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
                selected
                  ? "border-primary bg-primary-subtle text-foreground"
                  : "border-border bg-card text-muted-foreground",
                isWeekendDate(date) && !selected && "opacity-70"
              )}
            >
              <span className="text-xs font-medium tabular-nums">
                {formatPlanningDayMonth(date)}
              </span>
              <span className="text-xs">{formatPlanningWeekdayShort(date)}</span>
              {isToday ? (
                <span className="mt-0.5 text-xs font-medium text-primary">Bugün</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="space-y-3" role="tabpanel">
        {machines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz makine yok.</p>
        ) : (
          machines.map((machine) => {
            const cellJobs = jobMap.get(`${machine.id}_${selectedDate}`) ?? [];
            const state = deriveMachineState(machine);
            return (
              <Card key={machine.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{machine.name}</CardTitle>
                    <Badge machineState={state} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {cellJobs.map((job) => (
                    <PlanJobBlock
                      key={job.id}
                      job={job}
                      onOpen={() => onCellOpen(machine, selectedDate, job)}
                    />
                  ))}
                  <PlanCellAdd
                    jobCount={cellJobs.length}
                    onAdd={() => onCellOpen(machine, selectedDate, null)}
                    label={`${machine.name} — yeni sipariş`}
                  />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
