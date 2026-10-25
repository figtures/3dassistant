"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useMaterials } from "@/hooks/use-data";
import { getMaterialColors, getMaterialTotalStock } from "@/lib/materials";
import type { MaterialColor } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { formatGrams, formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, Loader2, Package, X } from "lucide-react";
import { toast } from "sonner";

const PRESET_MATERIALS = ["PLA", "PETG", "ASA", "ABS", "TPU", "Nylon", "PC", "HIPS"];

interface ColorFormRow {
  id?: string;
  color_name: string;
  hex_code: string;
  stock_grams: string;
}

function emptyColorRow(): ColorFormRow {
  return { color_name: "", hex_code: "", stock_grams: "" };
}

export default function MaterialsPage() {
  const queryClient = useQueryClient();
  const { data: materials = [], isLoading } = useMaterials();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", brand: "", price_per_kg: "" });
  const [colors, setColors] = useState<ColorFormRow[]>([emptyColorRow()]);
  const [saving, setSaving] = useState(false);

  function openCreate(preset?: string) {
    setEditing(null);
    setForm({ name: preset ?? "", brand: "", price_per_kg: "" });
    setColors([emptyColorRow()]);
    setModalOpen(true);
  }

  function openEdit(id: string) {
    const mat = materials.find((m) => m.id === id);
    if (!mat) return;
    setEditing(id);
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
          }))
        : [emptyColorRow()]
    );
    setModalOpen(true);
  }

  function addColorRow() {
    setColors((prev) => [...prev, emptyColorRow()]);
  }

  function removeColorRow(index: number) {
    setColors((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function updateColorRow(index: number, patch: Partial<ColorFormRow>) {
    setColors((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function syncMaterialColors(
    supabase: ReturnType<typeof createClient>,
    materialId: string,
    userId: string,
    rows: ColorFormRow[]
  ) {
    const valid = rows.filter((r) => r.color_name.trim());
    const keepIds = valid.map((r) => r.id).filter(Boolean) as string[];

    if (editing && keepIds.length) {
      const { data: existing } = await supabase
        .from("material_colors")
        .select("id")
        .eq("material_id", materialId);
      const toDelete = (existing ?? [])
        .map((c) => c.id)
        .filter((id) => !keepIds.includes(id));
      if (toDelete.length) {
        await supabase.from("material_colors").delete().in("id", toDelete);
      }
    } else if (editing) {
      await supabase.from("material_colors").delete().eq("material_id", materialId);
    }

    for (let i = 0; i < valid.length; i++) {
      const row = valid[i];
      const payload = {
        material_id: materialId,
        user_id: userId,
        color_name: row.color_name.trim(),
        hex_code: row.hex_code.trim() || null,
        stock_grams: parseInt(row.stock_grams, 10) || 0,
        sort_order: i,
      };
      if (row.id) {
        await supabase.from("material_colors").update(payload).eq("id", row.id);
      } else {
        await supabase.from("material_colors").insert(payload);
      }
    }
  }

  async function handleSave() {
    const validColors = colors.filter((c) => c.color_name.trim());
    if (!validColors.length) {
      toast.error("En az bir renk ekleyin");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const totalStock = validColors.reduce(
      (sum, c) => sum + (parseInt(c.stock_grams, 10) || 0),
      0
    );

    const payload = {
      name: form.name,
      brand: form.brand || null,
      color: null,
      price_per_kg: parseFloat(form.price_per_kg) || 0,
      stock_grams: totalStock,
    };

    if (editing) {
      const { error } = await supabase.from("materials").update(payload).eq("id", editing);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      await syncMaterialColors(supabase, editing, user.id, colors);
    } else {
      const { data: created, error } = await supabase
        .from("materials")
        .insert({ ...payload, user_id: user.id })
        .select("id")
        .single();
      if (error || !created) {
        toast.error(error?.message ?? "Malzeme eklenemedi");
        setSaving(false);
        return;
      }
      await syncMaterialColors(supabase, created.id, user.id, colors);
    }

    toast.success(editing ? "Malzeme güncellendi" : "Malzeme eklendi");
    queryClient.invalidateQueries({ queryKey: ["materials"] });
    setSaving(false);
    setModalOpen(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu malzemeyi silmek istediğinize emin misiniz?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Silindi");
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Malzemeler"
        description="PETG, ASA, PLA ve diğer filament stoklarınızı yönetin."
        action={
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" /> Malzeme Ekle
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {PRESET_MATERIALS.map((p) => (
          <button
            key={p}
            onClick={() => openCreate(p)}
            className="rounded-full bg-zinc-800/60 px-3.5 py-1.5 text-xs font-medium text-zinc-400 ring-1 ring-zinc-700/50 transition-all hover:bg-sky-500/10 hover:text-sky-400 hover:ring-sky-500/30"
          >
            + {p}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : materials.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Henüz malzeme yok"
          description="Filament envanterinizi ekleyerek iş emirlerinde hızlıca seçim yapın."
          action={
            <Button onClick={() => openCreate()}>
              <Plus className="h-4 w-4" /> İlk Malzemeyi Ekle
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((mat) => {
            const matColors = getMaterialColors(mat).sort(
              (a, b) => a.sort_order - b.sort_order
            );
            return (
              <div key={mat.id} className="glass glass-hover group rounded-2xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-zinc-100">{mat.name}</h3>
                    {mat.brand && <p className="mt-0.5 text-xs text-zinc-500">{mat.brand}</p>}
                    {matColors.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {matColors.map((c: MaterialColor) => (
                          <Badge key={c.id} variant="default">
                            {c.hex_code && (
                              <span
                                className="mr-1.5 inline-block h-2 w-2 rounded-full ring-1 ring-zinc-600"
                                style={{ backgroundColor: c.hex_code }}
                              />
                            )}
                            {c.color_name}
                            <span className="ml-1 text-zinc-500">
                              ({formatGrams(c.stock_grams)})
                            </span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(mat.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(mat.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-800/80 pt-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                      Toplam stok
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-zinc-300">
                      {formatGrams(getMaterialTotalStock(mat))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600">Fiyat</p>
                    <p className="mt-0.5 text-sm font-medium text-zinc-300">
                      {formatCurrency(mat.price_per_kg)}/kg
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onOpenChange={setModalOpen}>
        <ModalContent>
          <ModalHeader
            title={editing ? "Malzeme Düzenle" : "Yeni Malzeme"}
            subtitle="Malzeme bilgileri ve renk varyantları"
          />
          <ModalBody className="space-y-4">
            <div className="space-y-1">
              <Label>Malzeme Adı</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="PETG"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Marka</Label>
                <Input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Fiyat (₺/kg)</Label>
                <Input
                  type="number"
                  value={form.price_per_kg}
                  onChange={(e) => setForm({ ...form, price_per_kg: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Renkler</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addColorRow}>
                  <Plus className="h-3.5 w-3.5" /> Renk ekle
                </Button>
              </div>
              <div className="space-y-2">
                {colors.map((row, index) => (
                  <div
                    key={row.id ?? `new-${index}`}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_88px_100px_44px] sm:items-end"
                  >
                    <div className="space-y-1">
                      {index === 0 && (
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                          Renk adı
                        </span>
                      )}
                      <Input
                        value={row.color_name}
                        onChange={(e) => updateColorRow(index, { color_name: e.target.value })}
                        placeholder="Siyah"
                      />
                    </div>
                    <div className="space-y-1">
                      {index === 0 && (
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                          Hex
                        </span>
                      )}
                      <Input
                        value={row.hex_code}
                        onChange={(e) => updateColorRow(index, { hex_code: e.target.value })}
                        placeholder="#000"
                      />
                    </div>
                    <div className="space-y-1">
                      {index === 0 && (
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                          Stok (g)
                        </span>
                      )}
                      <Input
                        type="number"
                        value={row.stock_grams}
                        onChange={(e) => updateColorRow(index, { stock_grams: e.target.value })}
                        placeholder="500"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 shrink-0 sm:h-9 sm:w-9"
                      onClick={() => removeColorRow(index)}
                      disabled={colors.length <= 1}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
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
