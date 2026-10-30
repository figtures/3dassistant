"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useMachines } from "@/hooks/use-data";
import { machineSlotsLeft, useEntitlements } from "@/hooks/use-entitlements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Plus, Pencil, Trash2, Loader2, Cpu, RefreshCw, Cloud, Lock, Radio, LifeBuoy } from "lucide-react";
import { MachineLiveStatus } from "@/components/machines/machine-live-status";
import { CloudPrinterConnectModal } from "@/components/machines/cloud-printer-connect-modal";
import { WorkshopBridgeModal } from "@/components/machines/workshop-bridge-modal";
import { CloudPrinterOAuthHandler } from "@/components/machines/cloud-printer-oauth-handler";
import { VENDOR_LABELS } from "@/lib/printer-cloud/types";
import type { Machine, PrinterVendor } from "@/types/database";
import { toast } from "sonner";
import type { MachineStatus } from "@/types/database";
import { useSupportReport } from "@/components/support/report-problem-modal";

const STATUS_LABELS: Record<MachineStatus, string> = {
  active: "Aktif",
  maintenance: "Bakımda",
  offline: "Kapalı",
};

export default function MachinesLegacyPage() {
  const queryClient = useQueryClient();
  const { data: machines = [], isLoading } = useMachines({ live: true });
  const router = useRouter();
  const { data: ent } = useEntitlements();
  const slotsLeft = machineSlotsLeft(ent);
  const atMachineLimit = slotsLeft === 0;
  const cloudAllowed = ent?.entitlements.cloudMonitoring ?? false;
  const [modalOpen, setModalOpen] = useState(false);
  const [cloudConnectOpen, setCloudConnectOpen] = useState(false);
  const [bridgeOpen, setBridgeOpen] = useState(false);
  const [oauthAccountId, setOauthAccountId] = useState<string | null>(null);
  const [oauthMock, setOauthMock] = useState(false);
  const [reconnectAccountId, setReconnectAccountId] = useState<string | null>(null);
  const [reconnectVendor, setReconnectVendor] = useState<PrinterVendor | null>(null);
  const { openReport } = useSupportReport();

  const handleOAuthConnected = useCallback((accountId: string, mock: boolean, _vendor: string | null) => {
    setOauthAccountId(accountId);
    setOauthMock(mock);
    setCloudConnectOpen(true);
  }, []);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", model: "", status: "active" as MachineStatus });
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", model: "", status: "active" });
    setModalOpen(true);
  }

  function openEdit(id: string) {
    const m = machines.find((x) => x.id === id);
    if (!m) return;
    setEditing(id);
    setForm({ name: m.name, model: m.model ?? "", status: m.status });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = { name: form.name, model: form.model || null, status: form.status };

    if (editing) {
      const { error } = await supabase.from("machines").update(payload).eq("id", editing);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("machines").insert({
        ...payload,
        user_id: user.id,
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
        setSaving(false);
        return;
      }
    }

    toast.success(editing ? "Makine güncellendi" : "Makine eklendi");
    queryClient.invalidateQueries({ queryKey: ["machines"] });
    queryClient.invalidateQueries({ queryKey: ["entitlements"] });
    setSaving(false);
    setModalOpen(false);
  }

  async function handleSync(id: string) {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/machines/${id}/sync`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) {
        toast.error(data.error, {
          action: { label: "Planı yükselt", onClick: () => router.push("/billing?reason=cloud") },
        });
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

  async function handleDelete(id: string) {
    if (!confirm("Bu makineyi silmek istediğinize emin misiniz?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("machines").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Silindi");
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["entitlements"] });
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Makineler"
        description="Yazıcılarınızı üretici hesabınızla bağlayın; durumlarını her yerden canlı takip edin."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setReconnectAccountId(null);
                setReconnectVendor(null);
                setCloudConnectOpen(true);
              }}
            >
              {cloudAllowed ? <Cloud className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              Yazıcıları bağla
              {!cloudAllowed && ent ? " (kilitli)" : ""}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setBridgeOpen(true)}
              disabled={!cloudAllowed}
              title={!cloudAllowed ? "Atölye veya Filament Farm gerekir" : undefined}
            >
              <Radio className="h-4 w-4" /> Atölye köprüsü
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => openReport({ category: "bridge", subject: "Köprü / yazıcı sorunu" })}
            >
              <LifeBuoy className="h-4 w-4" /> Sorun bildir
            </Button>
            <Button onClick={openCreate} disabled={atMachineLimit}>
              <Plus className="h-4 w-4" /> Makine Ekle
            </Button>
          </div>
        }
      />

      {ent && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3 text-sm">
          <span className="text-zinc-400">
            Plan: <span className="text-zinc-200">{ent.entitlements.planName}</span> ·{" "}
            <span className={atMachineLimit ? "text-amber-400" : "text-zinc-200"}>
              {ent.usage.machines} / {ent.entitlements.maxMachines} makine
            </span>
            {cloudAllowed ? " · canlı takip açık" : " · buluttan bağlama kilitli"}
            {atMachineLimit && " · yeni makine için planı yükseltin"}
          </span>
          {(atMachineLimit || !cloudAllowed) && (
            <Link href="/billing" className="text-sky-400 hover:text-sky-300">
              Planı yükselt
            </Link>
          )}
        </div>
      )}

      {isLoading ? (
        <PageLoader />
      ) : machines.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="Henüz makine yok"
          description="Yazıcılarınızı ekleyerek planlama tablosunda iş emirleri oluşturun."
          action={
            <Button onClick={openCreate} disabled={atMachineLimit}>
              <Plus className="h-4 w-4" /> İlk Makineyi Ekle
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {machines.map((m) => (
            <div key={m.id} className="glass glass-hover group rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <Link
                    href={`/machines/${m.id}`}
                    className="font-semibold text-zinc-100 hover:text-sky-300"
                  >
                    {m.name}
                  </Link>
                  {m.model && <p className="mt-0.5 text-xs text-zinc-500">{m.model}</p>}
                </div>
                <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m.id)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(m.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 space-y-3 border-t border-zinc-800/80 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={m.status} />
                  <CloudIntegrationBadge machine={m} />
                  <BridgeBindingBadge machine={m} />
                </div>
                <MachineLiveStatus machine={m} />
                <div className="flex flex-wrap gap-2">
                  {m.machine_cloud_link?.integration_account?.status === "error" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs text-amber-300"
                      onClick={() => {
                        setReconnectAccountId(m.machine_cloud_link!.integration_account!.id);
                        setReconnectVendor(
                          m.machine_cloud_link!.integration_account!.vendor as PrinterVendor
                        );
                        setOauthAccountId(null);
                        setCloudConnectOpen(true);
                      }}
                    >
                      Hesabı yeniden bağla
                    </Button>
                  )}
                  {(m.machine_cloud_link?.enabled || m.bridge_binding?.id) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={syncingId === m.id}
                      onClick={() => handleSync(m.id)}
                    >
                      {syncingId === m.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      {m.bridge_binding?.id ? "Köprü durumu" : "Şimdi güncelle"}
                    </Button>
                  )}
                  <Link
                    href={`/machines/${m.id}`}
                    className="inline-flex h-8 items-center rounded-lg px-2 text-xs text-sky-400 hover:text-sky-300"
                  >
                    Detay →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Suspense fallback={null}>
        <CloudPrinterOAuthHandler onConnected={handleOAuthConnected} />
      </Suspense>

      <WorkshopBridgeModal open={bridgeOpen} onOpenChange={setBridgeOpen} />

      <CloudPrinterConnectModal
        open={cloudConnectOpen}
        onOpenChange={(open) => {
          setCloudConnectOpen(open);
          if (!open) {
            setOauthAccountId(null);
            setOauthMock(false);
            setReconnectAccountId(null);
            setReconnectVendor(null);
          }
        }}
        initialAccountId={oauthAccountId}
        initialMock={oauthMock}
        reconnectAccountId={reconnectAccountId}
        reconnectVendor={reconnectVendor}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["machines"] })}
      />

      <Modal open={modalOpen} onOpenChange={setModalOpen}>
        <ModalContent>
          <ModalHeader title={editing ? "Makine Düzenle" : "Yeni Makine"} subtitle="Yazıcı bilgilerini girin" />
          <ModalBody className="space-y-3">
            <div className="space-y-1">
              <Label>Makine Adı</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Printer 1" />
            </div>
            <div className="space-y-1">
              <Label>Model</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Bambu Lab X1C" />
            </div>
            <div className="space-y-1">
              <Label>Durum</Label>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as MachineStatus })}>
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onClick={handleSave} disabled={saving || !form.name} className="min-h-11 w-full sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function BridgeBindingBadge({ machine }: { machine: Machine }) {
  const binding = machine.bridge_binding;
  if (!binding?.id) return null;
  return (
    <Badge variant="primary" className="text-[10px]">
      <Radio className="mr-1 h-3 w-3" />
      Köprü
    </Badge>
  );
}

function CloudIntegrationBadge({ machine }: { machine: Machine }) {
  const link = machine.machine_cloud_link;
  const account = link?.integration_account;
  if (!link?.enabled || !account) return null;
  const label = VENDOR_LABELS[account.vendor as PrinterVendor] ?? account.display_name;
  return (
    <Badge variant="primary" className="text-[10px]">
      <Cloud className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: MachineStatus }) {
  const map = {
    active: { variant: "success" as const, label: "Aktif" },
    maintenance: { variant: "warning" as const, label: "Bakımda" },
    offline: { variant: "danger" as const, label: "Kapalı" },
  };
  const { variant, label } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}
