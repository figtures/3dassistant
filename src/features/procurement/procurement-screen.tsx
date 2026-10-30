"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useMaterialPurchases, useMaterials, useSuppliers } from "@/hooks/use-data";
import { useConfirm } from "@/hooks/use-confirm";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { mapProcurementVoiceToFormFields } from "@/lib/parse-note";
import { resolveVoiceParse, type VoiceParseSource } from "@/lib/voice-parse-client";
import { getMaterialColors } from "@/lib/materials";
import { formatCurrency } from "@/lib/format";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import type { MaterialPurchase } from "@/types/database";
import {
  Badge,
  Button,
  EmptyState,
  Skeleton,
} from "@/components/ds";
import {
  type ProcurementTab,
  type SpendPeriod,
  SPEND_PERIOD_LABELS,
} from "@/features/procurement/procurement-constants";
import {
  createPurchaseFormValues,
  emptySupplierForm,
  purchaseFormFromRecord,
  recalcPurchaseTotal,
  savePurchaseRecord,
  saveSupplierRecord,
  supplierFormFromRecord,
  type PurchaseFormValues,
  type SupplierFormValues,
} from "@/features/procurement/procurement-mutations";
import { PurchaseSheet } from "@/features/procurement/purchase-sheet";
import { PurchasesTable } from "@/features/procurement/purchases-table";
import { SupplierSheet } from "@/features/procurement/supplier-sheet";
import { SuppliersTable } from "@/features/procurement/suppliers-table";
import {
  filterPurchasesByPeriod,
  sumPurchaseTotals,
} from "@/features/procurement/procurement-utils";
import { cn } from "@/lib/utils";
import { Plus, ShoppingCart, Truck } from "lucide-react";
import { toast } from "sonner";

const selectClassName =
  "flex h-[var(--density-control-h)] rounded-lg border border-input bg-surface-inset px-3 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

function parseTab(value: string | null): ProcurementTab {
  return value === "suppliers" ? "suppliers" : "purchases";
}

function ProcurementV2Content() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmAction = useConfirm();

  const { data: suppliers = [], isLoading: supLoading, isError: supError, refetch: refetchSup } =
    useSuppliers();
  const { data: purchases = [], isLoading: purLoading, isError: purError, refetch: refetchPur } =
    useMaterialPurchases();
  const { data: materials = [] } = useMaterials();

  const tab = parseTab(searchParams.get("tab"));
  const [spendPeriod, setSpendPeriod] = useState<SpendPeriod>("30d");

  const [supplierSheetOpen, setSupplierSheetOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState<SupplierFormValues>(emptySupplierForm());
  const [savingSupplier, setSavingSupplier] = useState(false);

  const [purchaseSheetOpen, setPurchaseSheetOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormValues>(() =>
    createPurchaseFormValues({ suppliers: [], materials: [] })
  );
  const [savingPurchase, setSavingPurchase] = useState(false);

  const [voiceText, setVoiceText] = useState("");
  const [voiceMatched, setVoiceMatched] = useState<string[]>([]);
  const [voiceFieldConfidence, setVoiceFieldConfidence] = useState<VoiceFieldConfidence>({});
  const [voiceParseSource, setVoiceParseSource] = useState<VoiceParseSource | undefined>();

  const patchUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `/procurement?${qs}` : "/procurement", { scroll: false });
    },
    [router, searchParams]
  );

  const openPurchaseCreate = useCallback(
    (opts?: { materialId?: string; colorId?: string }) => {
      setEditingPurchaseId(null);
      setPurchaseForm(
        createPurchaseFormValues({
          suppliers,
          materials,
          materialId: opts?.materialId,
          colorId: opts?.colorId,
        })
      );
      setVoiceText("");
      setVoiceMatched([]);
      setVoiceFieldConfidence({});
      setVoiceParseSource(undefined);
      setPurchaseSheetOpen(true);
    },
    [materials, suppliers]
  );

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    openPurchaseCreate({
      materialId: searchParams.get("material") ?? undefined,
      colorId: searchParams.get("color") ?? undefined,
    });
    patchUrl({ new: null, material: null, color: null });
  }, [searchParams, openPurchaseCreate, patchUrl]);

  const filteredPurchases = useMemo(
    () => filterPurchasesByPeriod(purchases, spendPeriod),
    [purchases, spendPeriod]
  );

  const periodSpend = useMemo(() => {
    if (tab === "suppliers") return sumPurchaseTotals(purchases);
    return sumPurchaseTotals(filteredPurchases);
  }, [tab, purchases, filteredPurchases]);

  const colorOptions = useMemo(() => {
    if (!purchaseForm.material_id) return [];
    const mat = materials.find((m) => m.id === purchaseForm.material_id);
    return mat ? getMaterialColors(mat) : [];
  }, [materials, purchaseForm.material_id]);

  function setTab(next: ProcurementTab) {
    patchUrl({ tab: next === "purchases" ? null : next });
  }

  function openSupplierCreate() {
    setEditingSupplierId(null);
    setSupplierForm(emptySupplierForm());
    setSupplierSheetOpen(true);
  }

  function openSupplierEdit(id: string) {
    const s = suppliers.find((x) => x.id === id);
    if (!s) return;
    setEditingSupplierId(id);
    setSupplierForm(supplierFormFromRecord(s));
    setSupplierSheetOpen(true);
  }

  function openPurchaseEdit(p: MaterialPurchase) {
    setEditingPurchaseId(p.id);
    setPurchaseForm(purchaseFormFromRecord(p));
    setVoiceText("");
    setVoiceMatched([]);
    setPurchaseSheetOpen(true);
  }

  const applyVoice = useCallback(
    async (text: string) => {
      setVoiceText(text);
      const mats = materials.map((m) => ({
        id: m.id,
        name: m.name,
        material_colors: getMaterialColors(m).map((c) => ({
          id: c.id,
          color_name: c.color_name,
        })),
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

  async function handleSaveSupplier() {
    setSavingSupplier(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingSupplier(false);
      return;
    }
    const { error } = await saveSupplierRecord(
      supabase,
      user.id,
      editingSupplierId,
      supplierForm
    );
    setSavingSupplier(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(editingSupplierId ? "Tedarikçi güncellendi" : "Tedarikçi eklendi");
    setSupplierSheetOpen(false);
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
  }

  async function handleDeleteSupplier(id: string) {
    const s = suppliers.find((x) => x.id === id);
    const confirmed = await confirmAction({
      title: "Tedarikçiyi sil",
      description: s
        ? `"${s.name}" kaydını silmek istiyor musunuz?`
        : "Bu tedarikçiyi silmek istiyor musunuz?",
      confirmLabel: "Sil",
      tone: "destructive",
    });
    if (!confirmed) return;
    const supabase = createClient();
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Silindi");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    }
  }

  async function handleSavePurchase() {
    setSavingPurchase(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingPurchase(false);
      return;
    }
    const { error } = await savePurchaseRecord(
      supabase,
      user.id,
      editingPurchaseId,
      purchaseForm,
      materials
    );
    setSavingPurchase(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(
      editingPurchaseId ? "Alım güncellendi" : "Alım kaydedildi — stok güncellendi"
    );
    setPurchaseSheetOpen(false);
    queryClient.invalidateQueries({ queryKey: ["material_purchases"] });
    queryClient.invalidateQueries({ queryKey: ["materials"] });
  }

  async function handleDeletePurchase(id: string) {
    const confirmed = await confirmAction({
      title: "Alım kaydını sil",
      description: "Bu alım kaydını silmek stok düzeltmesi yapar. Devam edilsin mi?",
      confirmLabel: "Sil",
      tone: "destructive",
    });
    if (!confirmed) return;
    const supabase = createClient();
    const { error } = await supabase.from("material_purchases").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Silindi");
      queryClient.invalidateQueries({ queryKey: ["material_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    }
  }

  const isLoading = supLoading || purLoading;
  const isError = supError || purError;

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Tedarik verileri yüklenemedi"
        description="Bağlantınızı kontrol edip tekrar deneyin."
        action={
          <Button
            type="button"
            onClick={() => {
              void refetchSup();
              void refetchPur();
            }}
          >
            Yeniden dene
          </Button>
        }
      />
    );
  }

  const primaryAction =
    tab === "suppliers" ? (
      <Button type="button" onClick={openSupplierCreate} className="shrink-0">
        <Plus className="size-4" aria-hidden />
        Tedarikçi ekle
      </Button>
    ) : (
      <Button type="button" onClick={() => openPurchaseCreate()} className="shrink-0">
        <Plus className="size-4" aria-hidden />
        Alım kaydı
      </Button>
    );

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Tedarik
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Filament alımlarını kaydedin, tedarikçilerinizi yönetin ve dönemsel harcamayı takip
            edin.
          </p>
        </div>
        {primaryAction}
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div
          className="inline-flex rounded-lg border border-border bg-surface-2 p-1"
          role="tablist"
          aria-label="Tedarik sekmeleri"
        >
          {(
            [
              ["purchases", "Alımlar"],
              ["suppliers", "Tedarikçiler"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
                tab === id
                  ? "bg-surface-1 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tab === "purchases" && (
            <select
              className={selectClassName}
              value={spendPeriod}
              onChange={(e) => setSpendPeriod(e.target.value as SpendPeriod)}
              aria-label="Harcama dönemi"
            >
              {(Object.keys(SPEND_PERIOD_LABELS) as SpendPeriod[]).map((p) => (
                <option key={p} value={p}>
                  {SPEND_PERIOD_LABELS[p]}
                </option>
              ))}
            </select>
          )}
          <Badge tone="info" className="tabular-nums">
            {tab === "purchases" ? "Dönem harcaması" : "Toplam harcama"}:{" "}
            {formatCurrency(periodSpend)}
          </Badge>
        </div>
      </div>

      {tab === "suppliers" && (
        <>
          {suppliers.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Henüz tedarikçi yok"
              description="Satın alma kayıtlarında kullanmak için ilk tedarikçinizi ekleyin."
              action={
                <Button type="button" onClick={openSupplierCreate}>
                  <Plus className="size-4" aria-hidden />
                  Tedarikçi ekle
                </Button>
              }
            />
          ) : (
            <SuppliersTable
              suppliers={suppliers}
              onEdit={openSupplierEdit}
              onDelete={(id) => void handleDeleteSupplier(id)}
            />
          )}
        </>
      )}

      {tab === "purchases" && (
        <>
          {purchases.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Alım kaydı yok"
              description="Sesli not veya form ile filament alımınızı kaydedin; stok otomatik güncellenir."
              action={
                <Button type="button" onClick={() => openPurchaseCreate()}>
                  <Plus className="size-4" aria-hidden />
                  İlk alımı ekle
                </Button>
              }
            />
          ) : filteredPurchases.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Bu dönemde alım yok"
              description="Dönem filtresini genişletin veya yeni alım ekleyin."
              action={
                <Button type="button" variant="secondary" onClick={() => setSpendPeriod("all")}>
                  Tüm dönemi göster
                </Button>
              }
            />
          ) : (
            <PurchasesTable
              purchases={filteredPurchases}
              onEdit={openPurchaseEdit}
              onDelete={(id) => void handleDeletePurchase(id)}
            />
          )}
        </>
      )}

      <SupplierSheet
        open={supplierSheetOpen}
        onOpenChange={setSupplierSheetOpen}
        editing={editingSupplierId != null}
        form={supplierForm}
        onFormChange={setSupplierForm}
        onSave={() => void handleSaveSupplier()}
        saving={savingSupplier}
      />

      <PurchaseSheet
        open={purchaseSheetOpen}
        onOpenChange={setPurchaseSheetOpen}
        editing={editingPurchaseId != null}
        form={purchaseForm}
        onFormChange={setPurchaseForm}
        onRecalcTotal={() => setPurchaseForm((f) => recalcPurchaseTotal(f))}
        onSave={() => void handleSavePurchase()}
        saving={savingPurchase}
        suppliers={suppliers}
        materials={materials}
        colorOptions={colorOptions}
        voice={{
          isSupported,
          isListening,
          voiceText,
          onVoiceTextChange: setVoiceText,
          matched: voiceMatched,
          fieldConfidence: voiceFieldConfidence,
          parseSource: voiceParseSource,
          onToggleListen: () => (isListening ? stopListening() : startListening()),
        }}
      />
    </div>
  );
}

export function ProcurementV2() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 pb-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <ProcurementV2Content />
    </Suspense>
  );
}
