"use client";

import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  useJobs,
  useMachines,
  useMaterials,
  useCustomers,
  getPlanningDates,
} from "@/hooks/use-data";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/skeleton";
import { JobModal } from "@/components/planning/job-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Job, Machine } from "@/types/database";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

export default function PlanningLegacyPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [days, setDays] = useState(14);
  const [offset, setOffset] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{
    machine: Machine;
    date: string;
    job: Job | null;
  } | null>(null);
  const [addingMachine, setAddingMachine] = useState(false);
  const [newMachineName, setNewMachineName] = useState("");

  const dates = useMemo(() => getPlanningDates(days, offset), [days, offset]);

  const dateFrom = dates[0];
  const dateTo = dates[dates.length - 1];

  const { data: jobs = [], isLoading } = useJobs({ dateFrom, dateTo });
  const { data: machines = [] } = useMachines();
  const { data: materials = [] } = useMaterials();
  const { data: customers = [] } = useCustomers();

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

  async function handleAddMachine() {
    if (!newMachineName.trim()) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("machines").insert({
      user_id: user.id,
      name: newMachineName.trim(),
      sort_order: machines.length,
    });

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

  function formatDateHeader(dateStr: string) {
    return format(parseISO(dateStr), "d MMM\nEEE", { locale: tr });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planlama"
        description="Tarih ve makine bazında birden fazla iş emri ekleyebilirsiniz. Mevcut işe tıklayarak düzenleyin."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setOffset((o) => o + 7)} className="min-h-9">
              <ChevronLeft className="h-4 w-4" /> Geri
            </Button>
            <Button variant="outline" size="sm" onClick={() => setOffset((o) => Math.max(0, o - 7))} className="min-h-9">
              İleri <ChevronRight className="h-4 w-4" />
            </Button>
            <SelectDays days={days} onChange={setDays} />
          </div>
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <p className="px-4 pt-3 text-xs text-zinc-600 lg:hidden">
            Tabloyu yatay kaydırarak tüm makineleri görebilirsiniz.
          </p>
          <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <table className="premium-table w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 min-w-[100px] border-b border-r border-zinc-800/80 bg-zinc-900/95 px-4 py-3 text-left text-zinc-500 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.6)] backdrop-blur-sm">
                  Tarih
                </th>
                {machines.map((machine) => (
                  <th
                    key={machine.id}
                    className="min-w-[120px] border-b border-zinc-800/60 bg-zinc-900/50 px-4 py-3 text-center text-zinc-400"
                  >
                    {machine.name}
                    {machine.status !== "active" && (
                      <span className="ml-1 text-amber-400">⚠</span>
                    )}
                  </th>
                ))}
                <th className="min-w-[80px] border-b border-zinc-800/60 bg-zinc-900/50 px-2 py-2">
                  {addingMachine ? (
                    <div className="flex gap-1">
                      <Input
                        value={newMachineName}
                        onChange={(e) => setNewMachineName(e.target.value)}
                        placeholder="Makine adı"
                        className="h-7 text-xs"
                        onKeyDown={(e) => e.key === "Enter" && handleAddMachine()}
                      />
                      <Button size="sm" className="h-7 px-2 text-xs" onClick={handleAddMachine}>
                        ✓
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingMachine(true)}
                      className="flex w-full min-h-11 items-center justify-center gap-1 rounded-lg py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-sky-400"
                    >
                      <Plus className="h-3 w-3" /> Makine
                    </button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {dates.map((date) => (
                <tr key={date}>
                  <td className="sticky left-0 z-10 whitespace-pre-line border-r border-b border-zinc-800/40 bg-zinc-900/95 px-4 py-2.5 text-xs font-medium text-zinc-500 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.6)] backdrop-blur-sm">
                    {formatDateHeader(date)}
                  </td>
                  {machines.map((machine) => {
                    const cellJobs = jobMap.get(`${machine.id}_${date}`) ?? [];
                    return (
                      <td
                        key={`${date}_${machine.id}`}
                        className="border-b border-zinc-800/40 p-1 align-top"
                      >
                        <div className="flex min-h-14 flex-col gap-1">
                          {cellJobs.map((job) => (
                            <button
                              key={job.id}
                              type="button"
                              className="grid-cell flex w-full flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-xs transition-all hover:border-sky-500/30 hover:shadow-lg hover:shadow-sky-500/5"
                              style={{
                                backgroundColor: `${job.cell_color ?? STATUS_COLORS[job.status]}20`,
                                borderColor: `${job.cell_color ?? STATUS_COLORS[job.status]}40`,
                              }}
                              onClick={() =>
                                setSelectedCell({ machine, date, job })
                              }
                            >
                              <span className="w-full truncate px-0.5 font-medium text-zinc-200">
                                {job.title ?? job.customer?.name ?? "İş emri"}
                              </span>
                              <span className="flex items-center gap-1.5 text-[10px]">
                                {job.grams_used ? (
                                  <span className="text-zinc-500">{job.grams_used}g</span>
                                ) : null}
                                {job.revenue_amount != null && job.revenue_amount > 0 ? (
                                  <span className="text-emerald-500/80">
                                    ₺{job.revenue_amount}
                                  </span>
                                ) : null}
                                {job.material_color?.color_name ? (
                                  <span className="truncate text-zinc-500">
                                    {job.material?.name
                                      ? `${job.material.name} · ${job.material_color.color_name}`
                                      : job.material_color.color_name}
                                  </span>
                                ) : job.material?.name ? (
                                  <span className="truncate text-zinc-500">
                                    {job.material.name}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          ))}
                          <button
                            type="button"
                            className="flex w-full min-h-11 items-center justify-center rounded-xl border border-dashed border-zinc-800/60 py-2 text-zinc-600 transition-all hover:border-sky-500/40 hover:bg-sky-500/5 hover:text-sky-400"
                            onClick={() =>
                              setSelectedCell({ machine, date, job: null })
                            }
                            aria-label="Yeni iş emri ekle"
                          >
                            <Plus className="h-4 w-4" />
                            {cellJobs.length > 0 && (
                              <span className="ml-1 text-[10px] font-medium">Ekle</span>
                            )}
                          </button>
                        </div>
                      </td>
                    );
                  })}
                  <td className="border-b border-zinc-800/40" />
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {selectedCell && (
        <JobModal
          open={!!selectedCell}
          onClose={() => setSelectedCell(null)}
          job={selectedCell.job}
          machine={selectedCell.machine}
          date={selectedCell.date}
          materials={materials}
          customers={customers}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["jobs"] })}
        />
      )}
    </div>
  );
}

function SelectDays({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <select
      value={days}
      onChange={(e) => onChange(Number(e.target.value))}
            className="rounded-xl px-3 py-2 min-h-9 border border-zinc-700/80 bg-zinc-900/60 text-xs text-zinc-300"
    >
      <option value={7}>7 gün</option>
      <option value={14}>14 gün</option>
      <option value={21}>21 gün</option>
      <option value={30}>30 gün</option>
    </select>
  );
}
