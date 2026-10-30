"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDeliveryJobs, useJobs, useMachines } from "@/hooks/use-data";
import { Skeleton } from "@/components/ds";
import { DeliveryAlerts } from "@/components/dashboard/delivery-alerts";
import { OrderSheet } from "@/features/orders/order-sheet";
import { AgendaList } from "@/features/calendar/agenda-list";
import { MonthGrid } from "@/features/calendar/month-grid";
import type { Job, Machine } from "@/types/database";
import {
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { CalendarCheck, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";

type CalendarView = "month" | "list";

export function CalendarV2() {
  const queryClient = useQueryClient();

  const [view, setView] = useState<CalendarView>("month");
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const dateFrom = format(startOfMonth(subMonths(viewMonth, 1)), "yyyy-MM-dd");
  const dateTo = format(endOfMonth(addMonths(viewMonth, 1)), "yyyy-MM-dd");

  const { data: jobs = [], isLoading } = useJobs({
    dateFrom,
    dateTo,
    dateField: "delivery_date",
  });
  const { data: deliveryJobs = [], isLoading: alertsLoading } = useDeliveryJobs();
  const { data: machines = [] } = useMachines();

  const machineMap = useMemo(
    () => new Map(machines.map((m) => [m.id, m])),
    [machines]
  );

  const jobsWithDelivery = useMemo(
    () => jobs.filter((j) => j.delivery_date),
    [jobs]
  );

  const modalMachine: Machine | undefined = selectedJob
    ? (selectedJob.machine ?? machineMap.get(selectedJob.machine_id))
    : undefined;

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <HelpTitleRow>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <CalendarCheck className="h-6 w-6 text-primary" aria-hidden />
              Teslim Takvimi
            </h1>
          </HelpTitleRow>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Siparişlerin teslim tarihlerini ay görünümünde veya listede takip edin. Bir siparişe
            tıklayarak düzenleyebilirsiniz.
          </p>
        </div>
        <div
          className="inline-flex rounded-lg border border-border bg-surface-inset p-0.5"
          role="group"
          aria-label="Görünüm"
        >
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
              view === "month"
                ? "bg-surface-raised text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setView("month")}
          >
            <CalendarCheck className="h-4 w-4" aria-hidden />
            Ay
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
              view === "list"
                ? "bg-surface-raised text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4" aria-hidden />
            Liste
          </button>
        </div>
      </header>

      {alertsLoading ? null : (
        <DeliveryAlerts
          jobs={deliveryJobs}
          onSelectJob={(job) => setSelectedJob(job)}
          showCalendarLink={false}
        />
      )}

      {isLoading ? (
        <Skeleton className="h-[420px] w-full rounded-xl" />
      ) : view === "month" ? (
        <MonthGrid
          jobs={jobsWithDelivery}
          currentMonth={viewMonth}
          onMonthChange={setViewMonth}
          onSelectJob={setSelectedJob}
        />
      ) : (
        <AgendaList jobs={jobsWithDelivery} onSelectJob={setSelectedJob} />
      )}

      {selectedJob && modalMachine ? (
        <OrderSheet
          open
          onOpenChange={(open) => {
            if (!open) setSelectedJob(null);
          }}
          orderId={selectedJob.id}
          prefill={{
            machine_id: modalMachine.id,
            job_date: selectedJob.job_date,
          }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
            setSelectedJob(null);
          }}
        />
      ) : null}
    </div>
  );
}
