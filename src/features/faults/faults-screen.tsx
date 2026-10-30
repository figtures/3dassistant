"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useFaults, useFaultTypes, useMachines } from "@/hooks/use-data";
import { useConfirm } from "@/hooks/use-confirm";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { mapFaultVoiceToFormFields } from "@/lib/parse-note";
import { resolveVoiceParse, type VoiceParseSource } from "@/lib/voice-parse-client";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import type { Fault, FaultStatus } from "@/types/database";
import { Button, EmptyState, Skeleton } from "@/components/ds";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import {
  FAULT_STATUS_LABELS,
  type FaultStatusFilter,
} from "@/features/faults/fault-constants";
import { FaultSheet } from "@/features/faults/fault-sheet";
import { FaultsTable } from "@/features/faults/faults-table";
import {
  emptyFaultForm,
  faultFormFromRecord,
  resolveTypeOptions,
  saveFaultRecord,
  setMachineMaintenance,
} from "@/features/faults/fault-mutations";
import { cn } from "@/lib/utils";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";

const selectClassName =
  "flex h-[var(--density-control-h)] rounded-lg border border-input bg-surface-inset px-3 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

const STATUS_TABS: { id: FaultStatusFilter; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "open", label: FAULT_STATUS_LABELS.open },
  { id: "in_progress", label: FAULT_STATUS_LABELS.in_progress },
  { id: "resolved", label: FAULT_STATUS_LABELS.resolved },
];

function parseStatusFilter(value: string | null): FaultStatusFilter {
  if (value === "open" || value === "in_progress" || value === "resolved") return value;
  return "all";
}

function FaultsV2Content() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmAction = useConfirm();

  const { data: faults = [], isLoading, isError, refetch } = useFaults();
  const { data: faultTypes = [] } = useFaultTypes();
  const { data: machines = [] } = useMachines();

  const statusFilter = parseStatusFilter(searchParams.get("status"));
  const machineFilter = searchParams.get("machine") ?? "";

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingFault, setEditingFault] = useState<Fault | null>(null);
  const [form, setForm] = useState(emptyFaultForm());
  const [saving, setSaving] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const [voiceText, setVoiceText] = useState("");
  const [voiceMatched, setVoiceMatched] = useState<string[]>([]);
  const [voiceFieldConfidence, setVoiceFieldConfidence] = useState<VoiceFieldConfidence>({});
  const [voiceParseSource, setVoiceParseSource] = useState<VoiceParseSource | undefined>();

  const typeOptions = useMemo(() => resolveTypeOptions(faultTypes), [faultTypes]);

  const patchUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `/faults?${qs}` : "/faults", { scroll: false });
    },
    [router, searchParams]
  );

  const filtered = useMemo(() => {
    return faults.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (machineFilter && f.machine_id !== machineFilter) return false;
      return true;
    });
  }, [faults, statusFilter, machineFilter]);

  function openCreate() {
    setEditingFault(null);
    setForm(emptyFaultForm(machines[0]?.id));
    setVoiceText("");
    setVoiceMatched([]);
    setVoiceFieldConfidence({});
    setVoiceParseSource(undefined);
    setSheetOpen(true);
  }

  function openEdit(fault: Fault) {
    setEditingFault(fault);
    setForm(faultFormFromRecord(fault));
    setVoiceText("");
    setVoiceMatched([]);
    setSheetOpen(true);
  }

  const applyVoiceFinal = useCallback(
    async (text: string) => {
      setVoiceText(text);
      const types = faultTypes.map((t) => ({ id: t.id, name: t.name }));
      const mach = machines.map((m) => ({ id: m.id, name: m.name }));
      const { source, result: mapped } = await resolveVoiceParse(
        "fault",
        text,
        { machines: mach, faultTypes: types },
        () => mapFaultVoiceToFormFields(text, mach, types)
      );
      setVoiceParseSource(source);
      setVoiceMatched(mapped.matched);
      setVoiceFieldConfidence(mapped.fieldConfidence ?? {});
      setForm((prev) => ({
        ...prev,
        machine_id: mapped.machineId ?? prev.machine_id,
        fault_type_id: mapped.faultTypeId ?? prev.fault_type_id,
        fault_type_name: mapped.faultTypeName ?? prev.fault_type_name,
        duration_hours: mapped.durationHours ?? prev.duration_hours,
        fault_date: mapped.faultDate ?? prev.fault_date,
        status: (mapped.status as FaultStatus | undefined) ?? prev.status,
        description: mapped.description ?? text,
      }));
    },
    [machines, faultTypes]
  );

  const { isListening, isSupported, startListening, stopListening } = useSpeechRecognition({
    onResult: applyVoiceFinal,
    onInterim: setVoiceText,
  });

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await saveFaultRecord(
      supabase,
      user.id,
      editingFault?.id ?? null,
      form,
      faultTypes,
      typeOptions
    );
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["fault_types"] });
    toast.success(editingFault ? "Arıza güncellendi" : "Arıza kaydedildi");
    queryClient.invalidateQueries({ queryKey: ["faults"] });
    setSheetOpen(false);
  }

  async function handleDelete(id: string) {
    const confirmed = await confirmAction({
      title: "Arıza kaydını sil",
      description: "Bu arıza kaydını silmek istediğinize emin misiniz?",
      confirmLabel: "Sil",
      tone: "destructive",
    });
    if (!confirmed) return;
    const supabase = createClient();
    const { error } = await supabase.from("faults").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Silindi");
      queryClient.invalidateQueries({ queryKey: ["faults"] });
    }
  }

  async function handleSetMaintenance() {
    if (!form.machine_id) return;
    setMaintenanceLoading(true);
    const supabase = createClient();
    const { error } = await setMachineMaintenance(supabase, form.machine_id);
    setMaintenanceLoading(false);
    if (error) toast.error(error);
    else {
      toast.success("Makine bakıma alındı");
      queryClient.invalidateQueries({ queryKey: ["machines"] });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Arızalar yüklenemedi"
        description="Bağlantınızı kontrol edip tekrar deneyin."
        action={
          <Button type="button" onClick={() => void refetch()}>
            Yeniden dene
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <HelpTitleRow>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Arıza &amp; Bakım
            </h1>
          </HelpTitleRow>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Makine arızalarını kaydedin, duruş sürelerini takip edin.
          </p>
        </div>
        <Button type="button" onClick={openCreate} disabled={!machines.length} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          Arıza ekle
        </Button>
      </header>

      {!machines.length && (
        <p className="text-sm text-warning">
          Arıza kaydı için önce en az bir makine ekleyin.
        </p>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-surface-2 p-1"
          role="tablist"
          aria-label="Durum filtresi"
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.id}
              onClick={() =>
                patchUrl({ status: tab.id === "all" ? null : tab.id })
              }
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
                statusFilter === tab.id
                  ? "bg-surface-1 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          className={cn(selectClassName, "w-full lg:max-w-xs")}
          value={machineFilter}
          onChange={(e) => patchUrl({ machine: e.target.value || null })}
          aria-label="Makine filtresi"
        >
          <option value="">Tüm makineler</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {faults.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Henüz arıza kaydı yok"
          description="Sesli veya manuel girişle makine arızalarını kaydedin."
          action={
            <Button type="button" onClick={openCreate} disabled={!machines.length}>
              <Plus className="size-4" aria-hidden />
              İlk arızayı ekle
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Filtreye uygun kayıt yok"
          description="Durum veya makine filtresini değiştirmeyi deneyin."
          action={
            <Button
              type="button"
              variant="secondary"
              onClick={() => patchUrl({ status: null, machine: null })}
            >
              Filtreleri temizle
            </Button>
          }
        />
      ) : (
        <FaultsTable
          faults={filtered}
          onEdit={openEdit}
          onDelete={(id) => void handleDelete(id)}
        />
      )}

      <FaultSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editing={editingFault != null}
        form={form}
        onFormChange={setForm}
        onSave={() => void handleSave()}
        saving={saving}
        machines={machines}
        typeOptions={typeOptions}
        onSetMaintenance={editingFault ? () => void handleSetMaintenance() : undefined}
        maintenanceLoading={maintenanceLoading}
        voice={{
          isSupported,
          isListening,
          voiceText,
          onVoiceTextChange: setVoiceText,
          onVoiceBlur: (text) => void applyVoiceFinal(text),
          matched: voiceMatched,
          fieldConfidence: voiceFieldConfidence,
          parseSource: voiceParseSource,
          onToggleListen: () => {
            if (isListening) {
              stopListening();
              if (voiceText.trim()) void applyVoiceFinal(voiceText);
            } else {
              startListening();
            }
          },
        }}
      />
    </div>
  );
}

export function FaultsV2() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 pb-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <FaultsV2Content />
    </Suspense>
  );
}
