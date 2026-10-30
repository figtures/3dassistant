"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useMachines } from "@/hooks/use-data";
import { machineSlotsLeft, useEntitlements } from "@/hooks/use-entitlements";
import { useFleetLiveSse } from "@/hooks/use-machine-sse";
import { useConfirm } from "@/hooks/use-confirm";
import {
  Button,
  EmptyState,
  Skeleton,
} from "@/components/ds";
import { WorkshopBridgeModal } from "@/components/machines/workshop-bridge-modal";
import { PrinterConnectWizard } from "@/features/printer-connect/printer-connect-wizard";
import { PrinterConnectOAuthHandler } from "@/features/printer-connect/printer-connect-oauth-handler";
import type { Machine, MachineStatus, PrinterVendor } from "@/types/database";
import type { ConnectVendor } from "@/features/printer-connect/methods";
import type { UiMachineState } from "@/lib/machine-state";
import { toast } from "sonner";
import { Cpu, Cloud, Lock, MoreHorizontal, Plus, Radio } from "lucide-react";
import { FleetFilters, FleetFiltersEmptyHint } from "@/features/machines/fleet-filters";
import { MachineCard } from "@/features/machines/machine-card";
import { MachineRow } from "@/features/machines/machine-row";
import {
  MachineFormDialog,
  type MachineFormValues,
} from "@/features/machines/machine-form-dialog";
import { PlanUsageMeter } from "@/features/machines/plan-usage-meter";
import { UntrackedBanner } from "@/features/machines/untracked-banner";
import {
  isLiveTracked,
  matchesMachineSearch,
  matchesStateFilter,
  mergeFleetLive,
} from "@/features/machines/machine-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ds/dialog";

function MachinesV2Content() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmAction = useConfirm();

  const { data: machines = [], isLoading, isError, refetch } = useMachines({
    live: true,
  });
  const fleetLive = useFleetLiveSse(machines.length > 0);
  const { data: ent, isLoading: entLoading } = useEntitlements();

  const slotsLeft = machineSlotsLeft(ent);
  const atMachineLimit = slotsLeft === 0;
  const cloudAllowed = ent?.entitlements.cloudMonitoring ?? false;

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [stateFilter, setStateFilter] = useState<UiMachineState | "all">(
    () => (searchParams.get("state") as UiMachineState | "all" | null) ?? "all"
  );
  const viewParam = searchParams.get("view");
  const view: "grid" | "list" =
    viewParam === "list" || viewParam === "grid"
      ? viewParam
      : machines.length > 12
        ? "list"
        : "grid";

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardCloudAccount, setWizardCloudAccount] = useState<string | null>(null);
  const [wizardCloudMock, setWizardCloudMock] = useState(false);
  const [wizardConnectVendor, setWizardConnectVendor] = useState<ConnectVendor | null>(null);
  const [bridgeOpen, setBridgeOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [reconnectAccountId, setReconnectAccountId] = useState<string | null>(null);
  const [reconnectVendor, setReconnectVendor] = useState<PrinterVendor | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncAllRunning, setSyncAllRunning] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<MachineFormValues>({
    name: "",
    model: "",
    status: "active",
  });
  const [saving, setSaving] = useState(false);

  const merged = useMemo(
    () => mergeFleetLive(machines, fleetLive),
    [machines, fleetLive]
  );

  const untrackedCount = useMemo(
    () => merged.filter((m) => !isLiveTracked(m)).length,
    [merged]
  );

  const filtered = useMemo(() => {
    return merged.filter(
      (m) =>
        matchesMachineSearch(m, search) && matchesStateFilter(m, stateFilter)
    );
  }, [merged, search, stateFilter]);

  const patchUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `/machines?${qs}` : "/machines", { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setEditing(null);
    setForm({ name: "", model: "", status: "active" });
    setFormOpen(true);
    patchUrl({ new: null });
  }, [searchParams, patchUrl]);

  const handleOAuthConnected = useCallback(
    (accountId: string, mock: boolean, vendor: string | null) => {
      setWizardCloudAccount(accountId);
      setWizardCloudMock(mock);
      if (vendor === "bambu" || vendor === "creality") {
        setWizardConnectVendor(vendor);
      }
      setWizardOpen(true);
    },
    []
  );

  function openConnectWizard() {
    setReconnectAccountId(null);
    setReconnectVendor(null);
    setWizardCloudAccount(null);
    setWizardCloudMock(false);
    setWizardConnectVendor(null);
    setWizardOpen(true);
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: "", model: "", status: "active" });
    setFormOpen(true);
  }

  function openEdit(id: string) {
    const m = machines.find((x) => x.id === id);
    if (!m) return;
    setEditing(id);
    setForm({ name: m.name, model: m.model ?? "", status: m.status });
    setFormOpen(true);
  }

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

    const payload = {
      name: form.name.trim(),
      model: form.model.trim() || null,
      status: form.status,
    };

    if (editing) {
      const { error } = await supabase
        .from("machines")
        .update(payload)
        .eq("id", editing);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("machines").insert({
        ...payload,
        user_id: user.id,
        sort_order: machines.length,
      });
      if (error) {
        if (error.hint === "PLAN_MACHINE_LIMIT") {
          const { openUpgradePromptFromPlanError } = await import(
            "@/lib/billing/handle-plan-error"
          );
          openUpgradePromptFromPlanError(
            { error: error.message, hint: error.hint },
            "machine_slots"
          );
          queryClient.invalidateQueries({ queryKey: ["entitlements"] });
        } else {
          toast.error(error.message);
        }
        setSaving(false);
        return;
      }
    }

    toast.success(editing ? "Makine güncellendi" : "Makine eklendi");
    queryClient.invalidateQueries({ queryKey: ["machines"] });
    queryClient.invalidateQueries({ queryKey: ["entitlements"] });
    setSaving(false);
    setFormOpen(false);
  }

  async function handleSync(id: string) {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/machines/${id}/sync`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) {
        const { handlePlanErrorResponse } = await import(
          "@/lib/billing/handle-plan-error"
        );
        await handlePlanErrorResponse(res, data, "cloud_sync");
      } else if (data.fromBridge) {
        toast.info(data.message ?? "Köprü otomatik günceller");
      } else if (!res.ok) {
        toast.error(data.error ?? "Senkron başarısız");
      } else if (data.unreachable) {
        toast.warning("Yazıcıya ulaşılamadı — son durum kaydedildi");
      } else {
        toast.success("Durum güncellendi");
      }
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["machines", id] });
      queryClient.invalidateQueries({ queryKey: ["machine-telemetry-history", id] });
    } catch {
      toast.error("Ağ hatası");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleSyncAll() {
    setHeaderMenuOpen(false);
    const targets = merged.filter(
      (m) => m.machine_cloud_link?.enabled || m.bridge_binding?.id
    );
    if (targets.length === 0) {
      toast.info("Senkron edilecek bağlı makine yok");
      return;
    }
    setSyncAllRunning(true);
    let ok = 0;
    for (const m of targets) {
      try {
        const res = await fetch(`/api/machines/${m.id}/sync`, { method: "POST" });
        if (res.ok) ok += 1;
      } catch {
        /* devam */
      }
    }
    queryClient.invalidateQueries({ queryKey: ["machines"] });
    toast.success(`${ok} makine güncellendi`);
    setSyncAllRunning(false);
  }

  async function handleMaintenance(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("machines")
      .update({ status: "maintenance" as MachineStatus })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Makine bakıma alındı");
      queryClient.invalidateQueries({ queryKey: ["machines"] });
    }
  }

  async function handleDelete(id: string) {
    const confirmed = await confirmAction({
      title: "Makine silinsin mi?",
      description: "Geçmiş siparişler korunur. Bu işlem geri alınamaz.",
      confirmLabel: "Sil",
      tone: "destructive",
    });
    if (!confirmed) return;
    const supabase = createClient();
    const { error } = await supabase.from("machines").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Makine silindi");
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["entitlements"] });
    }
  }

  function handleReconnect(machine: Machine) {
    const account = machine.machine_cloud_link?.integration_account;
    if (!account) return;
    setReconnectAccountId(account.id);
    setReconnectVendor(account.vendor as PrinterVendor);
    setWizardCloudAccount(null);
    setWizardCloudMock(false);
    setWizardOpen(true);
  }

  const cardActions = {
    onEdit: openEdit,
    onDelete: handleDelete,
    onSync: handleSync,
    onMaintenance: handleMaintenance,
    onReconnect: handleReconnect,
    onConnect: openConnectWizard,
    syncingId,
  };

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="Makineler yüklenemedi"
        description="Bağlantınızı kontrol edip tekrar deneyin."
        action={
          <Button type="button" onClick={() => void refetch()}>
            Tekrar dene
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Makineler
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Yazıcı filonuzu bağlayın; baskı durumu, ilerleme ve sıcaklıkları tek
          ekrandan izleyin.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {entLoading ? (
            <Skeleton className="h-10 w-36 rounded-lg" />
          ) : (
            <Button type="button" onClick={openConnectWizard}>
              {cloudAllowed ? (
                <Cloud className="size-4" aria-hidden />
              ) : (
                <Lock className="size-4" aria-hidden />
              )}
              Yazıcı bağla
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setHeaderMenuOpen(true)}
            aria-label="Diğer makine işlemleri"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>

      {ent ? <PlanUsageMeter ent={ent} /> : null}

      <UntrackedBanner count={untrackedCount} onConnect={openConnectWizard} />

      {machines.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="Henüz makine yok"
          description="İlk yazıcınızı bağlayın veya elle ekleyerek planlamaya başlayın."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={openConnectWizard}>
                Yazıcı bağla
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={openCreate}
                disabled={atMachineLimit}
              >
                <Plus className="size-4" aria-hidden />
                Elle makine ekle
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <FleetFilters
            machines={merged}
            stateFilter={stateFilter}
            onStateFilterChange={(s) => {
              setStateFilter(s);
              patchUrl({ state: s === "all" ? null : s });
            }}
            search={search}
            onSearchChange={(q) => {
              setSearch(q);
              patchUrl({ q: q.trim() || null });
            }}
            view={view}
            onViewChange={(v) => patchUrl({ view: v === "grid" ? null : v })}
          />

          {filtered.length === 0 ? (
            <FleetFiltersEmptyHint
              onClear={() => {
                setSearch("");
                setStateFilter("all");
                patchUrl({ q: null, state: null });
              }}
            />
          ) : view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((m) => (
                <MachineCard key={m.id} machine={m} actions={cardActions} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((m) => (
                <MachineRow key={m.id} machine={m} actions={cardActions} />
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={headerMenuOpen} onOpenChange={setHeaderMenuOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Makine işlemleri</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setHeaderMenuOpen(false);
                openCreate();
              }}
              disabled={atMachineLimit}
            >
              <Plus className="size-4" aria-hidden />
              Elle makine ekle
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setHeaderMenuOpen(false);
                setBridgeOpen(true);
              }}
              disabled={!cloudAllowed}
            >
              <Radio className="size-4" aria-hidden />
              Atölye köprüsü
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={syncAllRunning}
              onClick={() => void handleSyncAll()}
            >
              Bağlı makineleri güncelle
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Suspense fallback={null}>
        <PrinterConnectOAuthHandler onConnected={handleOAuthConnected} />
      </Suspense>

      <WorkshopBridgeModal open={bridgeOpen} onOpenChange={setBridgeOpen} />

      <Dialog
        open={wizardOpen}
        onOpenChange={(open) => {
          setWizardOpen(open);
          if (!open) {
            setWizardCloudAccount(null);
            setWizardCloudMock(false);
            setWizardConnectVendor(null);
            setReconnectAccountId(null);
            setReconnectVendor(null);
          }
        }}
      >
        <DialogContent size="xl" className="max-h-[min(90vh,720px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Yazıcı bağla</DialogTitle>
          </DialogHeader>
          <PrinterConnectWizard
            key={`${wizardCloudAccount ?? "new"}-${reconnectAccountId ?? ""}-${wizardConnectVendor ?? ""}`}
            mode="dialog"
            onClose={() => setWizardOpen(false)}
            initialAccountId={wizardCloudAccount ?? reconnectAccountId}
            initialMock={wizardCloudMock}
            reconnectAccountId={reconnectAccountId}
            reconnectVendor={reconnectVendor}
            initialConnectVendor={wizardConnectVendor}
          />
        </DialogContent>
      </Dialog>

      <MachineFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={Boolean(editing)}
        form={form}
        onFormChange={setForm}
        onSave={() => void handleSave()}
        saving={saving}
      />
    </div>
  );
}

export function MachinesV2() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 pb-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
      }
    >
      <MachinesV2Content />
    </Suspense>
  );
}
