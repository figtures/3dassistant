"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useFaults, useFaultTypes, useMachines } from "@/hooks/use-data";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { mapFaultVoiceToFormFields } from "@/lib/parse-note";
import { resolveVoiceParse, type VoiceParseSource } from "@/lib/voice-parse-client";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select, Textarea, DateInput } from "@/components/ui/select";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { VoiceParsePanel } from "@/components/ui/voice-parse-panel";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import { formatHours } from "@/lib/utils";
import { formatDateTR } from "@/hooks/use-data";
import type { Fault, FaultStatus } from "@/types/database";
import {
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useUiVersion } from "@/components/flags/ui-version-provider";
import { useConfirm } from "@/hooks/use-confirm";

const STATUS_LABELS: Record<FaultStatus, string> = {
  open: "Açık",
  in_progress: "Devam ediyor",
  resolved: "Çözüldü",
};

const DEFAULT_FAULT_TYPES = [
  "Nozzle tıkanması",
  "Filament kopması",
  "Isıtıcı arızası",
  "Motor arızası",
  "Kalibrasyon",
  "Elektronik arıza",
];

export default function FaultsPage() {
  const queryClient = useQueryClient();
  const { data: faults = [], isLoading } = useFaults();
  const { data: faultTypes = [] } = useFaultTypes();
  const { data: machines = [] } = useMachines();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Fault | null>(null);
  const [saving, setSaving] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [voiceMatched, setVoiceMatched] = useState<string[]>([]);
  const [voiceFieldConfidence, setVoiceFieldConfidence] = useState<VoiceFieldConfidence>({});
  const [voiceParseSource, setVoiceParseSource] = useState<VoiceParseSource | undefined>();
  const uiVersion = useUiVersion();
  const confirmAction = useConfirm();

  const [form, setForm] = useState({
    machine_id: "",
    fault_type_id: "",
    fault_type_name: "",
    duration_hours: "",
    description: "",
    fault_date: new Date().toISOString().slice(0, 10),
    status: "open" as FaultStatus,
  });

  const typeOptions = faultTypes.length
    ? faultTypes
    : DEFAULT_FAULT_TYPES.map((name, i) => ({
        id: name,
        name,
        sort_order: i,
        user_id: "",
        created_at: "",
        updated_at: "",
      }));

  function openCreate() {
    setEditing(null);
    setForm({
      machine_id: machines[0]?.id ?? "",
      fault_type_id: "",
      fault_type_name: "",
      duration_hours: "",
      description: "",
      fault_date: new Date().toISOString().slice(0, 10),
      status: "open",
    });
    setVoiceText("");
    setVoiceMatched([]);
    setModalOpen(true);
  }

  function openEdit(fault: Fault) {
    setEditing(fault);
    setForm({
      machine_id: fault.machine_id,
      fault_type_id: fault.fault_type_id ?? "",
      fault_type_name: fault.fault_type_name ?? fault.fault_type?.name ?? "",
      duration_hours: String(fault.duration_hours ?? ""),
      description: fault.description ?? "",
      fault_date: fault.fault_date,
      status: fault.status,
    });
    setVoiceText("");
    setVoiceMatched([]);
    setModalOpen(true);
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
        status: mapped.status ?? prev.status,
        description: mapped.description ?? text,
      }));
    },
    [machines, faultTypes]
  );

  const { isListening, isSupported, startListening, stopListening } =
    useSpeechRecognition({
      onResult: applyVoiceFinal,
      onInterim: setVoiceText,
    });

  async function ensureFaultType(userId: string, name: string): Promise<string | null> {
    if (!name.trim()) return null;
    const existing = faultTypes.find(
      (t) => t.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (existing) return existing.id;

    const { data, error } = await supabaseInsertFaultType(userId, name.trim());
    if (error) return null;
    queryClient.invalidateQueries({ queryKey: ["fault_types"] });
    return data?.id ?? null;
  }

  async function supabaseInsertFaultType(userId: string, name: string) {
    const supabase = createClient();
    return supabase
      .from("fault_types")
      .insert({ user_id: userId, name, sort_order: faultTypes.length })
      .select("id")
      .single();
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const typeName =
      form.fault_type_name ||
      typeOptions.find((t) => t.id === form.fault_type_id)?.name ||
      "";
    let faultTypeId = form.fault_type_id || null;
    if (!faultTypeId && typeName) {
      faultTypeId = await ensureFaultType(user.id, typeName);
    }

    const payload = {
      user_id: user.id,
      machine_id: form.machine_id,
      fault_type_id: faultTypeId,
      fault_type_name: typeName || null,
      duration_hours: form.duration_hours ? parseFloat(form.duration_hours) : 0,
      description: form.description || null,
      fault_date: form.fault_date,
      status: form.status,
    };

    if (editing) {
      const { error } = await supabase.from("faults").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Arıza güncellendi");
    } else {
      const { error } = await supabase.from("faults").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Arıza kaydedildi");
    }

    queryClient.invalidateQueries({ queryKey: ["faults"] });
    setSaving(false);
    setModalOpen(false);
  }

  async function handleDelete(id: string) {
    const confirmed =
      uiVersion === "v2"
        ? await confirmAction({
            title: "Arıza kaydını sil",
            description: "Bu arıza kaydını silmek istediğinize emin misiniz?",
            confirmLabel: "Sil",
            tone: "destructive",
          })
        : confirm("Bu arıza kaydını silmek istediğinize emin misiniz?");
    if (!confirmed) return;
    const supabase = createClient();
    const { error } = await supabase.from("faults").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Silindi");
      queryClient.invalidateQueries({ queryKey: ["faults"] });
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Arızalar"
        description="Makine arızalarını kaydedin, duruş sürelerini takip edin."
        action={
          <Button onClick={openCreate} disabled={!machines.length}>
            <Plus className="h-4 w-4" /> Arıza Ekle
          </Button>
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : faults.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Henüz arıza kaydı yok"
          description="Sesli veya manuel girişle makine arızalarını kaydedin."
          action={
            <Button onClick={openCreate} disabled={!machines.length}>
              <Plus className="h-4 w-4" /> İlk Arızayı Ekle
            </Button>
          }
        />
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <table className="premium-table w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-900/50">
                {["Tarih", "Makine", "Arıza Tipi", "Süre", "Durum", "Açıklama", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {faults.map((f) => (
                <tr key={f.id} className="border-b border-zinc-800/40">
                  <td className="px-5 py-3.5 text-zinc-400">{formatDateTR(f.fault_date)}</td>
                  <td className="px-5 py-3.5 font-medium text-zinc-200">{f.machine?.name ?? "—"}</td>
                  <td className="px-5 py-3.5 text-zinc-300">
                    {f.fault_type_name ?? f.fault_type?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-400">{formatHours(f.duration_hours)}</td>
                  <td className="px-5 py-3.5">
                    <Badge variant={f.status === "resolved" ? "success" : "warning"}>
                      {STATUS_LABELS[f.status]}
                    </Badge>
                  </td>
                  <td className="max-w-[200px] truncate px-5 py-3.5 text-zinc-500">
                    {f.description ?? "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(f.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onOpenChange={setModalOpen}>
        <ModalContent>
          <ModalHeader title={editing ? "Arıza Düzenle" : "Yeni Arıza"} />
          <ModalBody className="space-y-4">
            <VoiceParsePanel
              isSupported={isSupported}
              isListening={isListening}
              voiceText={voiceText}
              onVoiceTextChange={setVoiceText}
              onVoiceBlur={applyVoiceFinal}
              matched={voiceMatched}
              fieldConfidence={voiceFieldConfidence}
              parseSource={voiceParseSource}
              placeholder="Makine, arıza tipi, süre bilgilerini söyleyin…"
              onToggleListen={() => {
                if (isListening) {
                  stopListening();
                  if (voiceText.trim()) applyVoiceFinal(voiceText);
                } else {
                  startListening();
                }
              }}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Makine</Label>
                <Select
                  value={form.machine_id}
                  onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
                >
                  <option value="">Seçin…</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tarih</Label>
                <DateInput
                  value={form.fault_date}
                  onChange={(e) => setForm({ ...form, fault_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Arıza tipi</Label>
                <Select
                  value={form.fault_type_id}
                  onChange={(e) => {
                    const t = typeOptions.find((x) => x.id === e.target.value);
                    setForm({
                      ...form,
                      fault_type_id: e.target.value,
                      fault_type_name: t?.name ?? "",
                    });
                  }}
                >
                  <option value="">Seçin veya yazın…</option>
                  {typeOptions.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Özel tip adı</Label>
                <Input
                  value={form.fault_type_name}
                  onChange={(e) => setForm({ ...form, fault_type_name: e.target.value })}
                  placeholder="Nozzle tıkanması"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Duruş süresi (saat)</Label>
                <Input
                  type="number"
                  step="0.25"
                  value={form.duration_hours}
                  onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Durum</Label>
                <Select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as FaultStatus })}
                >
                  {Object.entries(STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Açıklama</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onClick={handleSave} disabled={saving || !form.machine_id} className="min-h-11 w-full sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
