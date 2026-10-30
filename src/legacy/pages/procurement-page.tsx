"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useSuppliers, useMaterialPurchases, useMaterials } from "@/hooks/use-data";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { mapProcurementVoiceToFormFields } from "@/lib/parse-note";
import { resolveVoiceParse, type VoiceParseSource } from "@/lib/voice-parse-client";
import { getMaterialColors } from "@/lib/materials";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, Textarea, DateInput } from "@/components/ui/select";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { VoiceParsePanel } from "@/components/ui/voice-parse-panel";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import { FormSection, FormField } from "@/components/ui/form-section";
import { formatCurrency, formatGrams, cn } from "@/lib/utils";
import { formatDateTR } from "@/hooks/use-data";
import type { Supplier, MaterialPurchase } from "@/types/database";
import { ShoppingCart, Plus, Pencil, Trash2, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";

const CHANNELS = ["Trendyol", "Hepsiburada", "Amazon", "N11", "Direkt", "Diğer"];

type Tab = "suppliers" | "purchases";

export default function ProcurementLegacyPage() {
  const queryClient = useQueryClient();
  const { data: suppliers = [], isLoading: supLoading } = useSuppliers();
  const { data: purchases = [], isLoading: purLoading } = useMaterialPurchases();
  const { data: materials = [] } = useMaterials();
  const [tab, setTab] = useState<Tab>("purchases");

  const [supplierModal, setSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    contact_email: "",
    contact_phone: "",
    website: "",
    notes: "",
  });
  const [savingSupplier, setSavingSupplier] = useState(false);

  const [purchaseModal, setPurchaseModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<MaterialPurchase | null>(null);
  const [purchaseForm, setPurchaseForm] = useState({
    supplier_id: "",
    material_id: "",
    material_color_id: "",
    grams: "",
    unit_price: "",
    total: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    channel: "",
    order_url: "",
    invoice_ref: "",
    notes: "",
  });
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [voiceMatched, setVoiceMatched] = useState<string[]>([]);
  const [voiceFieldConfidence, setVoiceFieldConfidence] = useState<VoiceFieldConfidence>({});
  const [voiceParseSource, setVoiceParseSource] = useState<VoiceParseSource | undefined>();

  const colorOptions = purchaseForm.material_id
    ? getMaterialColors(materials.find((m) => m.id === purchaseForm.material_id)!)
    : [];

  function openSupplierCreate() {
    setEditingSupplier(null);
    setSupplierForm({ name: "", contact_email: "", contact_phone: "", website: "", notes: "" });
    setSupplierModal(true);
  }

  function openSupplierEdit(s: Supplier) {
    setEditingSupplier(s);
    setSupplierForm({
      name: s.name,
      contact_email: s.contact_email ?? "",
      contact_phone: s.contact_phone ?? "",
      website: s.website ?? "",
      notes: s.notes ?? "",
    });
    setSupplierModal(true);
  }

  async function saveSupplier() {
    if (!supplierForm.name.trim()) {
      toast.error("Tedarikçi adı gerekli");
      return;
    }
    setSavingSupplier(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      user_id: user.id,
      name: supplierForm.name.trim(),
      contact_email: supplierForm.contact_email.trim() || null,
      contact_phone: supplierForm.contact_phone.trim() || null,
      website: supplierForm.website.trim() || null,
      notes: supplierForm.notes.trim() || null,
    };
    const { error } = editingSupplier
      ? await supabase.from("suppliers").update(payload).eq("id", editingSupplier.id)
      : await supabase.from("suppliers").insert(payload);
    setSavingSupplier(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingSupplier ? "Tedarikçi güncellendi" : "Tedarikçi eklendi");
    setSupplierModal(false);
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
  }

  async function deleteSupplier(id: string) {
    if (!confirm("Bu tedarikçiyi silmek istiyor musunuz?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Silindi");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    }
  }

  function openPurchaseCreate() {
    setEditingPurchase(null);
    setPurchaseForm({
      supplier_id: suppliers[0]?.id ?? "",
      material_id: materials[0]?.id ?? "",
      material_color_id: "",
      grams: "",
      unit_price: "",
      total: "",
      purchase_date: new Date().toISOString().slice(0, 10),
      channel: "",
      order_url: "",
      invoice_ref: "",
      notes: "",
    });
    setVoiceMatched([]);
    setVoiceText("");
    setPurchaseModal(true);
  }

  function openPurchaseEdit(p: MaterialPurchase) {
    setEditingPurchase(p);
    setPurchaseForm({
      supplier_id: p.supplier_id ?? "",
      material_id: p.material_id,
      material_color_id: p.material_color_id ?? "",
      grams: String(p.grams),
      unit_price: String(p.unit_price),
      total: String(p.total),
      purchase_date: p.purchase_date,
      channel: p.channel ?? "",
      order_url: p.order_url ?? "",
      invoice_ref: p.invoice_ref ?? "",
      notes: p.notes ?? "",
    });
    setVoiceMatched([]);
    setPurchaseModal(true);
  }

  const applyVoice = useCallback(
    async (text: string) => {
      setVoiceText(text);
      const mats = materials.map((m) => ({
        id: m.id,
        name: m.name,
        material_colors: getMaterialColors(m).map((c) => ({ id: c.id, color_name: c.color_name })),
      }));
      const { source, result: mapped } = await resolveVoiceParse(
        "procurement",
        text,
        {
          materials: mats,
          suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
        },
        () => mapProcurementVoiceToFormFields(text, mats, suppliers)
      );
      setVoiceParseSource(source);
      setVoiceMatched(mapped.matched);
      setVoiceFieldConfidence(mapped.fieldConfidence ?? {});
      setPurchaseForm((prev) => ({
        ...prev,
        supplier_id: mapped.supplierId ?? prev.supplier_id,
        material_id: mapped.materialId ?? prev.material_id,
        material_color_id: mapped.materialColorId ?? prev.material_color_id,
        grams: mapped.grams ?? prev.grams,
        unit_price: mapped.unitPrice ?? prev.unit_price,
        total: mapped.total ?? prev.total,
        purchase_date: mapped.purchaseDate ?? prev.purchase_date,
        channel: mapped.channel ?? prev.channel,
        invoice_ref: mapped.invoiceRef ?? prev.invoice_ref,
        notes: mapped.notes ?? prev.notes,
      }));
    },
    [materials, suppliers]
  );

  const { isListening, isSupported, startListening, stopListening } = useSpeechRecognition({
    onResult: applyVoice,
    onInterim: setVoiceText,
  });

  function recalcTotal() {
    const g = parseFloat(purchaseForm.grams) || 0;
    const u = parseFloat(purchaseForm.unit_price) || 0;
    if (g && u) {
      setPurchaseForm((prev) => ({
        ...prev,
        total: String(Math.round(((u * g) / 1000) * 100) / 100),
      }));
    }
  }

  async function savePurchase() {
    const grams = parseInt(purchaseForm.grams, 10);
    if (!purchaseForm.material_id || !grams) {
      toast.error("Malzeme ve gram gerekli");
      return;
    }
    const mat = materials.find((m) => m.id === purchaseForm.material_id);
    const colors = mat ? getMaterialColors(mat) : [];
    if (colors.length > 0 && !purchaseForm.material_color_id) {
      toast.error("Stok güncellemesi için renk seçin veya malzemeye renk ekleyin");
      return;
    }
    setSavingPurchase(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const total =
      parseFloat(purchaseForm.total) ||
      Math.round(((parseFloat(purchaseForm.unit_price) || 0) * grams) / 1000 * 100) / 100;
    const payload = {
      user_id: user.id,
      supplier_id: purchaseForm.supplier_id || null,
      material_id: purchaseForm.material_id,
      material_color_id: purchaseForm.material_color_id || null,
      grams,
      unit_price: parseFloat(purchaseForm.unit_price) || 0,
      total,
      purchase_date: purchaseForm.purchase_date,
      channel: purchaseForm.channel || null,
      order_url: purchaseForm.order_url.trim() || null,
      invoice_ref: purchaseForm.invoice_ref.trim() || null,
      notes: purchaseForm.notes.trim() || null,
    };
    const { error } = editingPurchase
      ? await supabase.from("material_purchases").update(payload).eq("id", editingPurchase.id)
      : await supabase.from("material_purchases").insert(payload);
    setSavingPurchase(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingPurchase ? "Alım güncellendi" : "Alım kaydedildi — stok güncellendi");
    setPurchaseModal(false);
    queryClient.invalidateQueries({ queryKey: ["material_purchases"] });
    queryClient.invalidateQueries({ queryKey: ["materials"] });
  }

  async function deletePurchase(id: string) {
    if (!confirm("Bu alım kaydını silmek stok düzeltmesi yapar. Devam?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("material_purchases").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Silindi");
      queryClient.invalidateQueries({ queryKey: ["material_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    }
  }

  if (supLoading || purLoading) return <PageLoader />;

  const totalSpend = purchases.reduce((s, p) => s + Number(p.total), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tedarik"
        description="Filament alımları ve tedarikçi yönetimi"
        action={
          tab === "suppliers" ? (
            <Button onClick={openSupplierCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Tedarikçi
            </Button>
          ) : (
            <Button onClick={openPurchaseCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Alım Kaydı
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("purchases")}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
            tab === "purchases"
              ? "bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/25"
              : "text-zinc-500 hover:bg-zinc-800/60"
          )}
        >
          Alımlar
        </button>
        <button
          type="button"
          onClick={() => setTab("suppliers")}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
            tab === "suppliers"
              ? "bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/25"
              : "text-zinc-500 hover:bg-zinc-800/60"
          )}
        >
          Tedarikçiler
        </button>
        <Badge variant="default" className="ml-auto">
          Toplam harcama: {formatCurrency(totalSpend)}
        </Badge>
      </div>

      {tab === "suppliers" && (
        <>
          {suppliers.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Henüz tedarikçi yok"
              description="İlk tedarikçinizi ekleyerek başlayın"
              action={<Button onClick={openSupplierCreate}>Tedarikçi Ekle</Button>}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {suppliers.map((s) => (
                <div key={s.id} className="glass rounded-2xl border border-zinc-800/80 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-zinc-100">{s.name}</h3>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openSupplierEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteSupplier(s.id)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                  {s.contact_phone && (
                    <p className="mt-2 text-sm text-zinc-500">{s.contact_phone}</p>
                  )}
                  {s.website && <p className="truncate text-sm text-sky-400/80">{s.website}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "purchases" && (
        <>
          {purchases.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Alım kaydı yok"
              description="Sesli veya manuel filament alımı ekleyin"
              action={<Button onClick={openPurchaseCreate}>Alım Ekle</Button>}
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-zinc-800/80">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-zinc-800 bg-zinc-900/50 text-left text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Tarih</th>
                    <th className="px-4 py-3">Malzeme</th>
                    <th className="px-4 py-3">Gram</th>
                    <th className="px-4 py-3">Toplam</th>
                    <th className="px-4 py-3">Tedarikçi</th>
                    <th className="px-4 py-3">Kanal</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
                      <td className="px-4 py-3">{formatDateTR(p.purchase_date)}</td>
                      <td className="px-4 py-3">
                        {p.material?.name}
                        {p.material_color?.color_name && (
                          <span className="text-zinc-500"> · {p.material_color.color_name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{formatGrams(p.grams)}</td>
                      <td className="px-4 py-3">{formatCurrency(Number(p.total))}</td>
                      <td className="px-4 py-3">{p.supplier?.name ?? "—"}</td>
                      <td className="px-4 py-3">{p.channel ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="icon" variant="ghost" onClick={() => openPurchaseEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deletePurchase(p.id)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal open={supplierModal} onOpenChange={setSupplierModal}>
        <ModalContent>
          <ModalHeader title={editingSupplier ? "Tedarikçi Düzenle" : "Yeni Tedarikçi"} />
          <ModalBody className="space-y-4">
            <FormField label="Ad">
              <Input
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
              />
            </FormField>
            <FormField label="E-posta">
              <Input
                value={supplierForm.contact_email}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, contact_email: e.target.value })
                }
              />
            </FormField>
            <FormField label="Telefon">
              <Input
                value={supplierForm.contact_phone}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, contact_phone: e.target.value })
                }
              />
            </FormField>
            <FormField label="Web">
              <Input
                value={supplierForm.website}
                onChange={(e) => setSupplierForm({ ...supplierForm, website: e.target.value })}
              />
            </FormField>
            <FormField label="Notlar">
              <Textarea
                value={supplierForm.notes}
                onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
              />
            </FormField>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setSupplierModal(false)}>
              İptal
            </Button>
            <Button onClick={saveSupplier} disabled={savingSupplier}>
              {savingSupplier && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kaydet
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={purchaseModal} onOpenChange={setPurchaseModal}>
        <ModalContent className="max-w-xl">
          <ModalHeader title={editingPurchase ? "Alım Düzenle" : "Yeni Alım"} />
          <ModalBody className="space-y-4">
            <VoiceParsePanel
              isSupported={isSupported}
              isListening={isListening}
              voiceText={voiceText}
              onVoiceTextChange={setVoiceText}
              matched={voiceMatched}
              fieldConfidence={voiceFieldConfidence}
              parseSource={voiceParseSource}
              onToggleListen={() => (isListening ? stopListening() : startListening())}
            />
            <FormSection title="Alım bilgileri">
              <FormField label="Tedarikçi">
                <Select
                  value={purchaseForm.supplier_id}
                  onChange={(e) =>
                    setPurchaseForm({ ...purchaseForm, supplier_id: e.target.value })
                  }
                >
                  <option value="">Seçiniz</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Malzeme">
                <Select
                  value={purchaseForm.material_id}
                  onChange={(e) =>
                    setPurchaseForm({
                      ...purchaseForm,
                      material_id: e.target.value,
                      material_color_id: "",
                    })
                  }
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Renk (stok güncellemesi için)">
                <Select
                  value={purchaseForm.material_color_id}
                  onChange={(e) =>
                    setPurchaseForm({ ...purchaseForm, material_color_id: e.target.value })
                  }
                >
                  <option value="">Stok güncelleme yok</option>
                  {colorOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.color_name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Gram">
                  <Input
                    type="number"
                    value={purchaseForm.grams}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, grams: e.target.value })}
                    onBlur={recalcTotal}
                  />
                </FormField>
                <FormField label="Birim fiyat (₺/kg)">
                  <Input
                    type="number"
                    value={purchaseForm.unit_price}
                    onChange={(e) =>
                      setPurchaseForm({ ...purchaseForm, unit_price: e.target.value })
                    }
                    onBlur={recalcTotal}
                  />
                </FormField>
              </div>
              <FormField label="Toplam (₺)">
                <Input
                  type="number"
                  value={purchaseForm.total}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, total: e.target.value })}
                />
              </FormField>
              <FormField label="Tarih">
                <DateInput
                  value={purchaseForm.purchase_date}
                  onChange={(e) =>
                    setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Kanal">
                <Select
                  value={purchaseForm.channel}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, channel: e.target.value })}
                >
                  <option value="">Seçiniz</option>
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Fatura ref">
                <Input
                  value={purchaseForm.invoice_ref}
                  onChange={(e) =>
                    setPurchaseForm({ ...purchaseForm, invoice_ref: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Sipariş URL">
                <Input
                  value={purchaseForm.order_url}
                  onChange={(e) =>
                    setPurchaseForm({ ...purchaseForm, order_url: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Notlar">
                <Textarea
                  value={purchaseForm.notes}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                />
              </FormField>
            </FormSection>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setPurchaseModal(false)}>
              İptal
            </Button>
            <Button onClick={savePurchase} disabled={savingPurchase}>
              {savingPurchase && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kaydet
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
