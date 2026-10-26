"use client";

import type { Job, Machine } from "@/types/database";
import { deriveMachineState, type UiMachineState } from "@/lib/machine-state";
import {
  formatPlanningDayMonth,
  formatPlanningWeekdayLong,
  formatPlanningWeekdayShort,
  isWeekendDate,
  todayIsoInIstanbul,
} from "@/lib/format";
import { PlanCellAdd, PlanJobBlock } from "@/features/planning/plan-cell";
import { cn } from "@/lib/utils";

function MachineStateDot({ state }: { state: UiMachineState }) {
  const colorClass: Record<UiMachineState, string> = {
    printing: "bg-state-printing pf-pulse-dot",
    paused: "bg-state-paused",
    idle: "bg-state-idle",
    error: "bg-state-error",
    offline: "bg-state-offline",
    maintenance: "bg-state-maintenance",
    untracked: "bg-state-unknown",
    unknown: "bg-state-unknown",
  };

  return (
    <span
      className={cn("size-2 shrink-0 rounded-full", colorClass[state])}
      aria-hidden
    />
  );
}

export type PlanGridProps = {
  machines: Machine[];
  dates: string[];
  jobMap: Map<string, Job[]>;
  onCellOpen: (machine: Machine, date: string, job: Job | null) => void;
};

export function PlanGrid({ machines, dates, jobMap, onCellOpen }: PlanGridProps) {
  const today = todayIsoInIstanbul();

  return (
    <div className="overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-card shadow-e0 [-webkit-overflow-scrolling:touch]">
      <p className="px-4 pt-3 text-xs text-muted-foreground lg:hidden">
        Tabloyu yatay kaydırarak tüm günleri görebilirsiniz.
      </p>
      <table
        className="w-full min-w-[720px] border-collapse text-sm"
        role="grid"
        aria-label="Üretim planı"
      >
        <thead>
          <tr role="row">
            <th
              scope="col"
              role="columnheader"
              className="sticky left-0 z-30 min-w-[140px] border-b border-r border-border bg-card px-3 py-3 text-left text-xs font-medium text-muted-foreground shadow-[4px_0_12px_-4px_rgb(0_0_0/0.35)]"
            >
              Makine
            </th>
            {dates.map((date) => {
              const isToday = date === today;
              const weekend = isWeekendDate(date);
              return (
                <th
                  key={date}
                  scope="col"
                  role="columnheader"
                  className={cn(
                    "sticky top-0 z-20 min-w-[108px] border-b border-border bg-card px-2 py-2 text-center",
                    isToday && "border-t-2 border-t-primary bg-primary-subtle",
                    weekend && !isToday && "opacity-60"
                  )}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xs font-medium tabular-nums text-foreground">
                      {formatPlanningDayMonth(date)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatPlanningWeekdayShort(date)}
                    </span>
                    {isToday ? (
                      <span className="text-xs font-medium text-primary">Bugün</span>
                    ) : null}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {machines.map((machine) => {
            const state = deriveMachineState(machine);
            return (
              <tr key={machine.id} role="row">
                <th
                  scope="row"
                  role="rowheader"
                  className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-2 text-left shadow-[4px_0_12px_-4px_rgb(0_0_0/0.35)]"
                >
                  <div className="flex items-center gap-2">
                    <MachineStateDot state={state} />
                    <span className="truncate text-sm font-medium text-foreground">
                      {machine.name}
                    </span>
                    {machine.status !== "active" ? (
                      <span className="text-xs text-warning" title="Makine aktif değil">
                        ⚠
                      </span>
                    ) : null}
                  </div>
                </th>
                {dates.map((date) => {
                  const cellJobs = jobMap.get(`${machine.id}_${date}`) ?? [];
                  const ariaLabel = `${machine.name}, ${formatPlanningDayMonth(date)} ${formatPlanningWeekdayLong(date)}, ${cellJobs.length} sipariş`;
                  return (
                    <td
                      key={`${machine.id}_${date}`}
                      role="gridcell"
                      tabIndex={-1}
                      aria-label={ariaLabel}
                      className={cn(
                        "border-b border-border p-1.5 align-top",
                        isWeekendDate(date) && date !== today && "bg-surface-inset/40"
                      )}
                    >
                      <div className="flex min-h-[52px] flex-col gap-1">
                        {cellJobs.map((job) => (
                          <PlanJobBlock
                            key={job.id}
                            job={job}
                            onOpen={() => onCellOpen(machine, date, job)}
                          />
                        ))}
                        <PlanCellAdd
                          jobCount={cellJobs.length}
                          onAdd={() => onCellOpen(machine, date, null)}
                          label={`${machine.name}, ${formatPlanningDayMonth(date)} — yeni sipariş`}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
