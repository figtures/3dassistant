"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getPlanningDates,
  useJobs,
  useMachines,
} from "@/hooks/use-data";
import { OrderSheet } from "@/features/orders/order-sheet";
import { DayListMobile } from "@/features/planning/day-list-mobile";
import { PlanGrid } from "@/features/planning/plan-grid";
import { PlanToolbar } from "@/features/planning/plan-toolbar";
import { Button, EmptyState, Skeleton } from "@/components/ds";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import type { Job, Machine } from "@/types/database";
import { todayIsoInIstanbul } from "@/lib/format";
import { CalendarRange } from "lucide-react";
import { toast } from "sonner";

export function PlanningV2() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [days, setDays] = useState(14);
  const [offset, setOffset] = useState(0);
  const [machineFilter, setMachineFilter] = useState("");
  const [selectedDateMobile, setSelectedDateMobile] = useState(() =>
    todayIsoInIstanbul()
  );
  const [selectedCell, setSelectedCell] = useState<{
    machine: Machine;
    date: string;
    job: Job | null;
  } | null>(null);
  const [addingMachine, setAddingMachine] = useState(false);
  const [newMachineName, setNewMachineName] = useState("");
  const [addMachineLoading, setAddMachineLoading] = useState(false);

  const dates = useMemo(() => getPlanningDates(days, offset), [days, offset]);
  const dateFrom = dates[0];
  const dateTo = dates[dates.length - 1];

  const { data: jobs = [], isLoading, isError, refetch } = useJobs({
    dateFrom,
    dateTo,
  });
  const { data: machines = [] } = useMachines();
  const visibleMachines = useMemo(() => {
    if (!machineFilter) return machines;
    return machines.filter((m) => m.id === machineFilter);
  }, [machines, machineFilter]);

  const jobMap = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const job of jobs) {
      const key = `${job.machine_id}_${job.job_date}`;
      const list = map.get(key) ?? [];
      list.push(job);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return map;
  }, [jobs]);

  function handleGoToday() {
    setOffset(0);
    setSelectedDateMobile(todayIsoInIstanbul());
  }

  async function handleAddMachine() {
    if (!newMachineName.trim()) return;
    setAddMachineLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setAddMachineLoading(false);
      return;
    }

    const { error } = await supabase.from("machines").insert({
      user_id: user.id,
      name: newMachineName.trim(),
      sort_order: machines.length,
    });
    setAddMachineLoading(false);

    if (error) {
      if (error.hint === "PLAN_MACHINE_LIMIT") {
        toast.error(error.message, {
          action: { label: "Planı yükselt", onClick: () => router.push("/billing") },
        });
        queryClient.invalidateQueries({ queryKey: ["entitlements"] });
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Makine eklendi");
    setNewMachineName("");
    setAddingMachine(false);
    queryClient.invalidateQueries({ queryKey: ["machines"] });
    queryClient.invalidateQueries({ queryKey: ["entitlements"] });
  }

  function openCell(machine: Machine, date: string, job: Job | null) {
    setSelectedCell({ machine, date, job });
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="space-y-1">
        <HelpTitleRow>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Üretim planı
          </h1>
        </HelpTitleRow>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Makine ve güne göre siparişleri planlayın. Hücreye tıklayarak sipariş
          ekleyin veya düzenleyin.
        </p>
      </header>

      <PlanToolbar
        days={days}
        onDaysChange={setDays}
        offset={offset}
        onOffsetChange={setOffset}
        onGoToday={handleGoToday}
        machineFilter={machineFilter}
        onMachineFilterChange={setMachineFilter}
        machines={machines}
        addingMachine={addingMachine}
        onAddingMachineChange={setAddingMachine}
        newMachineName={newMachineName}
        onNewMachineNameChange={setNewMachineName}
        onAddMachine={handleAddMachine}
        addMachineLoading={addMachineLoading}
      />

      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="hidden h-[420px] w-full rounded-xl lg:block" />
          <Skeleton className="h-80 w-full rounded-xl lg:hidden" />
        </div>
      ) : isError ? (
        <div
          className="rounded-xl border border-border bg-card p-5"
          role="alert"
        >
          <p className="text-sm text-foreground">Plan yüklenemedi.</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>
            Tekrar dene
          </Button>
        </div>
      ) : machines.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Henüz makine yok"
          description="Plan oluşturmak için önce bir makine ekleyin."
          action={
            <Button type="button" onClick={() => setAddingMachine(true)}>
              Makine ekle
            </Button>
          }
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <PlanGrid
              machines={visibleMachines}
              dates={dates}
              jobMap={jobMap}
              onCellOpen={openCell}
            />
          </div>
          <DayListMobile
            dates={dates}
            selectedDate={
              dates.includes(selectedDateMobile)
                ? selectedDateMobile
                : (dates[dates.length - 1] ?? selectedDateMobile)
            }
            onSelectedDateChange={setSelectedDateMobile}
            machines={visibleMachines}
            jobMap={jobMap}
            onCellOpen={openCell}
          />
        </>
      )}

      {selectedCell ? (
        <OrderSheet
          open
          onOpenChange={(open) => {
            if (!open) setSelectedCell(null);
          }}
          orderId={selectedCell.job?.id ?? "new"}
          prefill={{
            machine_id: selectedCell.machine.id,
            job_date: selectedCell.date,
          }}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["jobs"] })}
        />
      ) : null}
    </div>
  );
}
