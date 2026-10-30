"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useMaterials } from "@/hooks/use-data";
import { getMaterialColors } from "@/lib/materials";
import { useConfirm } from "@/hooks/use-confirm";
import {
  Button,
  EmptyState,
  Input,
  Skeleton,
} from "@/components/ds";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import { MaterialSheet } from "@/features/materials/material-sheet";
import {
  MaterialsTable,
} from "@/features/materials/materials-table";
import { StockAdjustDialog } from "@/features/materials/stock-adjust-dialog";
import { BulkStockAdjustDialog } from "@/features/materials/bulk-stock-adjust-dialog";
import {
  bulkApplyStockDelta,
  type BulkStockColorTarget,
} from "@/features/materials/bulk-actions";
import { BulkBar } from "@/components/ds/data-table/bulk-bar";
import {
  deleteMaterial,
  emptyColorRow,
  saveMaterial,
  updateColorStock,
  type ColorFormRow,
  type MaterialFormValues,
} from "@/features/materials/material-mutations";
import type { Material, MaterialColor } from "@/types/database";
import { useTenantId } from "@/components/workspace/workspace-provider";
import { isLowStock, lowStockThreshold } from "@/lib/stock";
import { cn } from "@/lib/utils";
import { formatBulkSummary } from "@/features/orders/bulk-actions";
import { Cylinder, Package, Plus } from "lucide-react";
import { toast } from "sonner";

const PRESET_MATERIALS = ["PLA", "PETG", "ASA", "ABS", "TPU", "Nylon", "PC", "HIPS"];

export function MaterialsV2() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmAction = useConfirm();
  const { data: materials = [], isLoading, isError, refetch } = useMaterials();

  const patchUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `/materials?${qs}` : "/materials", { scroll: false });
    },
    [router, searchParams]
  );

  const [search, setSearch] = useState("");
  const stockFilter = searchParams.get("stock") === "critical";
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MaterialFormValues>({
    name: "",
    brand: "",
    price_per_kg: "",
  });
  const [colors, setColors] = useState<ColorFormRow[]>([emptyColorRow()]);
  const [saving, setSaving] = useState(false);

  const [adjustTarget, setAdjustTarget] = useState<{
    materialId: string;
    colorId: string;
    materialName: string;
    colorName: string;
    currentGrams: number;
  } | null>(null);
  const [adjustValue, setAdjustValue] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);

  const [selectedColors, setSelectedColors] = useState<
    Map<string, BulkStockColorTarget>
  >(() => new Map());
  const [bulkAdjustOpen, setBulkAdjustOpen] = useState(false);
  const [bulkDelta, setBulkDelta] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const filtered = useMemo(() => {
    let list = materials;
    if (stockFilter) {
      list = list.filter((m) =>
        getMaterialColors(m).some((c) =>
          isLowStock(c.stock_grams, lowStockThreshold(c.low_stock_grams))
        )
      );
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => {
      if (m.name.toLowerCase().includes(q)) return true;
      if (m.brand?.toLowerCase().includes(q)) return true;
      return getMaterialColors(m).some((c) =>
        c.color_name.toLowerCase().includes(q)
      );
    });
  }, [materials, search, stockFilter]);

  const visibleColorTargets = useMemo(() => {
    const targets: BulkStockColorTarget[] = [];
    for (const mat of filtered) {
      for (const color of getMaterialColors(mat)) {
        targets.push({
          colorId: color.id,
          materialId: mat.id,
          currentGrams: color.stock_grams ?? 0,
        });
      }
    }
    return targets;
  }, [filtered]);

  useEffect(() => {
    setSelectedColors(new Map());
  }, [search, stockFilter]);

  const allColorsSelected =
    visibleColorTargets.length > 0 &&
    visibleColorTargets.every((t) => selectedColors.has(t.colorId));
  const selectIndeterminate =
    selectedColors.size > 0 && !allColorsSelected;

  function handleToggleColorSelect(target: BulkStockColorTarget) {
    setSelectedColors((prev) => {
      const next = new Map(prev);
      if (next.has(target.colorId)) next.delete(target.colorId);
      else next.set(target.colorId, target);
      return next;
    });
  }

  function handleToggleSelectAllColors() {
    if (allColorsSelected) {
      setSelectedColors(new Map());
      return;
    }
    const next = new Map<string, BulkStockColorTarget>();
    for (const t of visibleColorTargets) {
      next.set(t.colorId, t);
    }
    setSelectedColors(next);
  }

  async function handleBulkStockSave() {
    const targets = [...selectedColors.values()];
    if (!targets.length) return;
    const delta = parseInt(bulkDelta, 10);
    if (Number.isNaN(delta)) {
      toast.error("Geçerli bir gram değişimi girin");
      return;
    }
    setBulkSaving(true);
    const supabase = createClient();
    const result = await bulkApplyStockDelta(supabase, targets, delta);
    if (result.error) toast.error(result.error);
    else {
      toast.success(formatBulkSummary(result.updated, result.skipped, "renk"));
      setSelectedColors(new Map());
      setBulkAdjustOpen(false);
      setBulkDelta("");
      await queryClient.invalidateQueries({ queryKey: ["materials"] });
    }
    setBulkSaving(false);
  }

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function openCreate(preset?: string) {
    setEditingId(null);
    setForm({ name: preset ?? "", brand: "", price_per_kg: "" });
    setColors([emptyColorRow()]);
    setSheetOpen(true);
  }

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setEditingId(null);
    setForm({ name: "", brand: "", price_per_kg: "" });
    setColors([emptyColorRow()]);
    setSheetOpen(true);
    patchUrl({ new: null });
  }, [searchParams, patchUrl]);

  function openEdit(id: string) {
    const mat = materials.find((m) => m.id === id);
    if (!mat) return;
    setEditingId(id);
    setForm({
      name: mat.name,
      brand: mat.brand ?? "",
      price_per_kg: String(mat.price_per_kg),
    });
    const existing = getMaterialColors(mat);
    setColors(
      existing.length
        ? existing.map((c) => ({
            id: c.id,
            color_name: c.color_name,
            hex_code: c.hex_code ?? "",
            stock_grams: String(c.stock_grams),
            low_stock_grams:
              c.low_stock_grams != null ? String(c.low_stock_grams) : "",
          }))
        : [emptyColorRow()]
    );
    setSheetOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();

    const result = await saveMaterial(supabase, tenantId, editingId, form, colors);
    if (result.error) {
      toast.error(result.error);
      setSaving(false);
      return;
    }

    toast.success(editingId ? "Malzeme güncellendi" : "Malzeme eklendi");
    await queryClient.invalidateQueries({ queryKey: ["materials"] });
    setSaving(false);
    setSheetOpen(false);
  }

  async function handleDelete(id: string) {
    const mat = materials.find((m) => m.id === id);
    const confirmed = await confirmAction({
      title: "Malzemeyi sil",
      description: mat
        ? `"${mat.name}" silinsin mi? Geçmiş sipariş kayıtları korunur.`
        : "Bu malzemeyi silmek istediğinize emin misiniz?",
      confirmLabel: "Sil",
      tone: "destructive",
    });
    if (!confirmed) return;

    const supabase = createClient();
    const result = await deleteMaterial(supabase, id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Malzeme silindi");
    await queryClient.invalidateQueries({ queryKey: ["materials"] });
  }

  function openAdjustStock(material: Material, color: MaterialColor) {
    setAdjustTarget({
      materialId: material.id,
      colorId: color.id,
      materialName: material.name,
      colorName: color.color_name,
      currentGrams: color.stock_grams ?? 0,
    });
    setAdjustValue(String(color.stock_grams ?? 0));
  }

  async function handleAdjustSave() {
    if (!adjustTarget) return;
    setAdjustSaving(true);
    const supabase = createClient();
    const grams = parseInt(adjustValue, 10);
    if (Number.isNaN(grams)) {
      toast.error("Geçerli bir gram değeri girin");
      setAdjustSaving(false);
      return;
    }
    const result = await updateColorStock(
      supabase,
      adjustTarget.colorId,
      adjustTarget.materialId,
      grams
    );
    if (result.error) {
      toast.error(result.error);
      setAdjustSaving(false);
      return;
    }
    toast.success("Stok güncellendi");
    await queryClient.invalidateQueries({ queryKey: ["materials"] });
    setAdjustSaving(false);
    setAdjustTarget(null);
  }

  const tableActions = {
    onEdit: openEdit,
    onDelete: handleDelete,
    onAdjustStock: openAdjustStock,
  };

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={Cylinder}
        title="Malzemeler yüklenemedi"
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
              Filament &amp; Malzeme
            </h1>
          </HelpTitleRow>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            PETG, PLA ve diğer filament stoklarınızı renk bazında takip edin.
          </p>
        </div>
        <Button type="button" onClick={() => openCreate()} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          Malzeme ekle
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            data-page-search
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Malzeme veya renk ara…"
            className="max-w-sm"
            aria-label="Malzeme ara"
          />
          <Button
            type="button"
            size="sm"
            variant={stockFilter ? "primary" : "secondary"}
            className={cn(!stockFilter && "border-dashed")}
            onClick={() =>
              patchUrl({ stock: stockFilter ? null : "critical" })
            }
            aria-pressed={stockFilter}
          >
            Kritik stok
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESET_MATERIALS.map((p) => (
            <Button
              key={p}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => openCreate(p)}
            >
              + {p}
            </Button>
          ))}
        </div>
      </div>

      {materials.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Henüz malzeme yok"
          description="Filament envanterinizi ekleyerek iş emirlerinde hızlıca seçim yapın."
          action={
            <Button type="button" onClick={() => openCreate()}>
              <Plus className="size-4" aria-hidden />
              İlk malzemeyi ekle
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sonuç bulunamadı"
          description="Arama terimini değiştirmeyi deneyin."
        />
      ) : (
        <>
          {selectedColors.size > 0 ? (
            <BulkBar
              count={selectedColors.size}
              label="renk seçili"
              onClear={() => setSelectedColors(new Map())}
            >
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setBulkAdjustOpen(true)}
              >
                Stok düzelt
              </Button>
            </BulkBar>
          ) : null}
          <MaterialsTable
            materials={filtered}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            actions={tableActions}
            selectedColors={new Set(selectedColors.keys())}
            onToggleColorSelect={handleToggleColorSelect}
            onToggleSelectAllColors={handleToggleSelectAllColors}
            allColorsSelected={allColorsSelected}
            selectIndeterminate={selectIndeterminate}
          />
        </>
      )}

      <MaterialSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editing={editingId != null}
        form={form}
        onFormChange={setForm}
        colors={colors}
        onColorsChange={setColors}
        onSave={() => void handleSave()}
        saving={saving}
      />

      <StockAdjustDialog
        target={adjustTarget}
        onOpenChange={(open) => {
          if (!open) setAdjustTarget(null);
        }}
        value={adjustValue}
        onValueChange={setAdjustValue}
        onSave={() => void handleAdjustSave()}
        saving={adjustSaving}
      />

      <BulkStockAdjustDialog
        open={bulkAdjustOpen}
        onOpenChange={setBulkAdjustOpen}
        colorCount={selectedColors.size}
        deltaValue={bulkDelta}
        onDeltaChange={setBulkDelta}
        onSave={() => void handleBulkStockSave()}
        saving={bulkSaving}
      />
    </div>
  );
}
