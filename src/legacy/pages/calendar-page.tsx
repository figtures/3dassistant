"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useJobs,
  useDeliveryJobs,
  useMachines,
  useMaterials,
  useCustomers,
} from "@/hooks/use-data";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/skeleton";
import { DeliveryCalendar } from "@/components/calendar/delivery-calendar";
import { DeliveryAlerts } from "@/components/dashboard/delivery-alerts";
import { JobModal } from "@/components/planning/job-modal";
import type { Job, Machine } from "@/types/database";
import {
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";

export default function CalendarLegacyPage() {
  const queryClient = useQueryClient();
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
  const { data: materials = [] } = useMaterials();
  const { data: customers = [] } = useCustomers();
  const { data: machines = [] } = useMachines();

  const machineMap = useMemo(
    () => new Map(machines.map((m) => [m.id, m])),
    [machines]
  );

  const jobsWithDelivery = useMemo(
    () => jobs.filter((j) => j.delivery_date),
    [jobs]
  );

  function handleSelectJob(job: Job) {
    setSelectedJob(job);
  }

  const modalMachine: Machine | undefined = selectedJob
    ? (selectedJob.machine ?? machineMap.get(selectedJob.machine_id))
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teslim Takvimi"
        description="İş emirlerinin teslim tarihlerini Google Takvim benzeri görünümde takip edin. Bir işe tıklayarak planlama modalında düzenleyebilirsiniz."
      />

      {alertsLoading ? null : (
        <DeliveryAlerts
          jobs={deliveryJobs}
          onSelectJob={handleSelectJob}
          showCalendarLink={false}
        />
      )}

      {isLoading ? (
        <PageLoader />
      ) : (
        <DeliveryCalendar
          jobs={jobsWithDelivery}
          currentMonth={viewMonth}
          onMonthChange={setViewMonth}
          onSelectJob={handleSelectJob}
        />
      )}

      {selectedJob && modalMachine && (
        <JobModal
          open={!!selectedJob}
          onClose={() => setSelectedJob(null)}
          job={selectedJob}
          machine={modalMachine}
          date={selectedJob.job_date}
          materials={materials}
          customers={customers}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
            setSelectedJob(null);
          }}
        />
      )}
    </div>
  );
}
