"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCustomers } from "@/hooks/use-data";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { mapCustomerVoiceToFormFields } from "@/lib/parse-note";
import { VoiceParsePanel } from "@/components/ui/voice-parse-panel";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import { CUSTOMER_SOURCES } from "@/types/database";
import {
  downloadCustomerTemplate,
  parseCustomerExcel,
  exportCustomersToExcel,
} from "@/lib/excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/skeleton";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Users,
  Download,
  Upload,
  FileSpreadsheet,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const { data: customers = [], isLoading } = useCustomers();
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    notes: "",
    source: "",
    referral: "",
    referred_by_customer_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [voiceMatched, setVoiceMatched] = useState<string[]>([]);
  const [voiceFieldConfidence, setVoiceFieldConfidence] = useState<VoiceFieldConfidence>({});
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{ name: string; email?: string; phone?: string; company?: string; notes?: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { isListening, isSupported, startListening, stopListening } = useSpeechRecognition({
    onResult: (text) => {
      setVoiceText(text);
      const mapped = mapCustomerVoiceToFormFields(
        text,
        customers.map((c) => ({ id: c.id, name: c.name }))
      );
      setVoiceMatched(mapped.matched);
      setVoiceFieldConfidence(mapped.fieldConfidence ?? {});
      setForm((prev) => ({
        ...prev,
        name: mapped.name ?? prev.name,
        source: mapped.source ?? prev.source,
        referral: mapped.referral ?? prev.referral,
        referred_by_customer_id: mapped.referredByCustomerId ?? prev.referred_by_customer_id,
      }));
    },
    onInterim: setVoiceText,
  });

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      company: "",
      notes: "",
      source: "",
      referral: "",
      referred_by_customer_id: "",
    });
    setVoiceText("");
    setVoiceMatched([]);
    setVoiceFieldConfidence({});
    setModalOpen(true);
  }

  function openEdit(id: string) {
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    setEditing(id);
    setForm({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      company: c.company ?? "",
      notes: c.notes ?? "",
      source: c.source ?? "",
      referral: c.referral ?? "",
      referred_by_customer_id: c.referred_by_customer_id ?? "",
    });
    setVoiceText("");
    setVoiceMatched([]);
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      company: form.company || null,
      notes: form.notes || null,
      source: form.source || null,
      referral: form.referral || null,
      referred_by_customer_id: form.referred_by_customer_id || null,
    };

    if (editing) {
      const { error } = await supabase.from("customers").update(payload).eq("id", editing);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("customers").insert({ ...payload, user_id: user.id });
      if (error) { toast.error(error.message); setSaving(false); return; }
    }

    toast.success(editing ? "Müşteri güncellendi" : "Müşteri eklendi");
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    setSaving(false);
    setModalOpen(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu müşteriyi silmek istediğinize emin misiniz?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Silindi");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseCustomerExcel(file);
      setImportPreview(rows);
      setImportModalOpen(true);
    } catch {
      toast.error("Excel dosyası okunamadı");
    }
  }

  async function handleImport() {
    setImporting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const rows = importPreview.map((r) => ({
      user_id: user.id,
      name: r.name,
      email: r.email || null,
      phone: r.phone || null,
      company: r.company || null,
      notes: r.notes || null,
    }));

    const { error } = await supabase.from("customers").insert(rows);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${rows.length} müşteri içe aktarıldı`);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setImportModalOpen(false);
      setImportPreview([]);
    }
    setImporting(false);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Müşteriler"
        description="Müşteri listesini yönetin, Excel ile toplu içe ve dışa aktarın."
        action={
          <>
            <Button variant="outline" size="sm" onClick={downloadCustomerTemplate}>
              <Download className="h-4 w-4" /> Şablon
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> İçe Aktar
            </Button>
            {customers.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => exportCustomersToExcel(customers)}>
                <FileSpreadsheet className="h-4 w-4" /> Dışa Aktar
              </Button>
            )}
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Müşteri Ekle
            </Button>
          </>
        }
      />
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />

      {isLoading ? (
        <PageLoader />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Henüz müşteri yok"
          description="Manuel ekleyin veya Excel şablonunu indirip toplu içe aktarın."
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadCustomerTemplate}>
                <Download className="h-4 w-4" /> Şablon İndir
              </Button>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Müşteri Ekle
              </Button>
            </div>
          }
        />
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <table className="premium-table w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-900/50">
                {["Ad Soyad", "E-posta", "Telefon", "Kaynak", "Referans", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-zinc-800/40">
                  <td className="px-5 py-3.5 font-medium text-zinc-200">{c.name}</td>
                  <td className="px-5 py-3.5 text-zinc-500">{c.email ?? "—"}</td>
                  <td className="px-5 py-3.5 text-zinc-500">{c.phone ?? "—"}</td>
                  <td className="px-5 py-3.5 text-zinc-500">{c.source ?? "—"}</td>
                  <td className="max-w-[140px] truncate px-5 py-3.5 text-zinc-600">{c.referral ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-0.5">
                      <Link href={`/customers/${c.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c.id)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(c.id)}>
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
          <ModalHeader title={editing ? "Müşteri Düzenle" : "Yeni Müşteri"} />
          <ModalBody className="space-y-3">
            <VoiceParsePanel
              isSupported={isSupported}
              isListening={isListening}
              voiceText={voiceText}
              onVoiceTextChange={setVoiceText}
              matched={voiceMatched}
              fieldConfidence={voiceFieldConfidence}
              placeholder="Örn: müşteri adı Deniz Yıldız, referans Ahmet Yılmaz, kaynak Instagram"
              onToggleListen={() => (isListening ? stopListening() : startListening())}
            />
            <div className="space-y-1">
              <Label>Ad Soyad</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>E-posta</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Telefon</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Firma</Label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Notlar</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Kaynak</Label>
                <Select
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                >
                  <option value="">Seçin…</option>
                  {CUSTOMER_SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Referans (metin)</Label>
                <Input
                  value={form.referral}
                  onChange={(e) => setForm({ ...form, referral: e.target.value })}
                  placeholder="Yönlendiren kişi"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Yönlendiren müşteri</Label>
              <Select
                value={form.referred_by_customer_id}
                onChange={(e) => setForm({ ...form, referred_by_customer_id: e.target.value })}
              >
                <option value="">Seçin…</option>
                {customers
                  .filter((c) => c.id !== editing)
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
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

      <Modal open={importModalOpen} onOpenChange={setImportModalOpen}>
        <ModalContent className="max-w-lg">
          <ModalHeader title="Excel İçe Aktarma Önizleme" />
          <ModalBody>
          <p className="mb-3 text-sm text-zinc-400">
            {importPreview.length} müşteri bulundu. Onaylayarak içe aktarın.
          </p>
          <div className="max-h-60 overflow-y-auto overscroll-contain rounded-lg border border-zinc-800/80">
            <table className="w-full min-w-[480px] text-xs">
              <thead>
                <tr className="bg-zinc-900/80">
                  <th className="px-3 py-2 text-left text-zinc-400">Ad</th>
                  <th className="px-3 py-2 text-left text-zinc-400">E-posta</th>
                  <th className="px-3 py-2 text-left text-zinc-400">Telefon</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.map((r, i) => (
                  <tr key={i} className="border-t border-zinc-800/60">
                    <td className="px-3 py-2 text-zinc-200">{r.name}</td>
                    <td className="px-3 py-2 text-zinc-400">{r.email ?? "-"}</td>
                    <td className="px-3 py-2 text-zinc-400">{r.phone ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setImportModalOpen(false)} className="min-h-11">
              İptal
            </Button>
            <Button onClick={handleImport} disabled={importing} className="min-h-11">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : `${importPreview.length} Müşteri Aktar`}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
