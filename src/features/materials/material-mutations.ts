import type { SupabaseClient } from "@supabase/supabase-js";

export type ColorFormRow = {
  id?: string;
  color_name: string;
  hex_code: string;
  stock_grams: string;
  /** Boş = varsayılan eşik (500 g) */
  low_stock_grams: string;
};

export function emptyColorRow(): ColorFormRow {
  return { color_name: "", hex_code: "", stock_grams: "", low_stock_grams: "" };
}

function parseLowStockGrams(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

function isMissingLowStockColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("low_stock_grams") &&
    (lower.includes("column") || lower.includes("schema cache"))
  );
}

export async function syncMaterialColors(
  supabase: SupabaseClient,
  materialId: string,
  userId: string,
  rows: ColorFormRow[],
  isEditing: boolean
): Promise<{ error?: string }> {
  const valid = rows.filter((r) => r.color_name.trim());
  const keepIds = valid.map((r) => r.id).filter(Boolean) as string[];

  if (isEditing && keepIds.length) {
    const { data: existing } = await supabase
      .from("material_colors")
      .select("id")
      .eq("material_id", materialId);
    const toDelete = (existing ?? [])
      .map((c) => c.id)
      .filter((id) => !keepIds.includes(id));
    if (toDelete.length) {
      const { error } = await supabase
        .from("material_colors")
        .delete()
        .in("id", toDelete);
      if (error) return { error: error.message };
    }
  } else if (isEditing) {
    const { error } = await supabase
      .from("material_colors")
      .delete()
      .eq("material_id", materialId);
    if (error) return { error: error.message };
  }

  for (let i = 0; i < valid.length; i++) {
    const row = valid[i];
    const lowStock = parseLowStockGrams(row.low_stock_grams);
    const payload: Record<string, unknown> = {
      material_id: materialId,
      user_id: userId,
      color_name: row.color_name.trim(),
      hex_code: row.hex_code.trim() || null,
      stock_grams: parseInt(row.stock_grams, 10) || 0,
      sort_order: i,
      low_stock_grams: lowStock,
    };
    if (row.id) {
      let { error } = await supabase
        .from("material_colors")
        .update(payload)
        .eq("id", row.id);
      if (error && isMissingLowStockColumnError(error.message)) {
        const { low_stock_grams: _drop, ...fallback } = payload;
        ({ error } = await supabase
          .from("material_colors")
          .update(fallback)
          .eq("id", row.id));
      }
      if (error) return { error: error.message };
    } else {
      let { error } = await supabase.from("material_colors").insert(payload);
      if (error && isMissingLowStockColumnError(error.message)) {
        const { low_stock_grams: _drop, ...fallback } = payload;
        ({ error } = await supabase.from("material_colors").insert(fallback));
      }
      if (error) return { error: error.message };
    }
  }

  return {};
}

export type MaterialFormValues = {
  name: string;
  brand: string;
  price_per_kg: string;
};

export async function saveMaterial(
  supabase: SupabaseClient,
  userId: string,
  editingId: string | null,
  form: MaterialFormValues,
  colors: ColorFormRow[]
): Promise<{ error?: string }> {
  const validColors = colors.filter((c) => c.color_name.trim());
  if (!validColors.length) {
    return { error: "En az bir renk ekleyin" };
  }

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

  if (editingId) {
    const { error } = await supabase
      .from("materials")
      .update(payload)
      .eq("id", editingId);
    if (error) return { error: error.message };
    return syncMaterialColors(supabase, editingId, userId, colors, true);
  }

  const { data: created, error } = await supabase
    .from("materials")
    .insert({ ...payload, user_id: userId })
    .select("id")
    .single();
  if (error || !created) {
    return { error: error?.message ?? "Malzeme eklenemedi" };
  }
  return syncMaterialColors(supabase, created.id, userId, colors, false);
}

export async function deleteMaterial(
  supabase: SupabaseClient,
  materialId: string
): Promise<{ error?: string }> {
  const { error } = await supabase.from("materials").delete().eq("id", materialId);
  if (error) return { error: error.message };
  return {};
}

export async function updateColorStock(
  supabase: SupabaseClient,
  colorId: string,
  materialId: string,
  newStockGrams: number
): Promise<{ error?: string }> {
  const grams = Math.max(0, Math.round(newStockGrams));
  const { error: colorError } = await supabase
    .from("material_colors")
    .update({ stock_grams: grams })
    .eq("id", colorId);
  if (colorError) return { error: colorError.message };

  const { data: colors } = await supabase
    .from("material_colors")
    .select("stock_grams")
    .eq("material_id", materialId);
  const total = (colors ?? []).reduce((s, c) => s + (c.stock_grams ?? 0), 0);
  const { error: matError } = await supabase
    .from("materials")
    .update({ stock_grams: total })
    .eq("id", materialId);
  if (matError) return { error: matError.message };
  return {};
}
