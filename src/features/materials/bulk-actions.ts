import type { SupabaseClient } from "@supabase/supabase-js";

export type BulkStockColorTarget = {
  colorId: string;
  materialId: string;
  currentGrams: number;
};

export type BulkStockMutationResult = {
  requested: number;
  updated: number;
  skipped: number;
  error: string | null;
};

export async function bulkApplyStockDelta(
  supabase: SupabaseClient,
  targets: BulkStockColorTarget[],
  deltaGrams: number
): Promise<BulkStockMutationResult> {
  const requested = targets.length;
  if (!requested) {
    return { requested: 0, updated: 0, skipped: 0, error: null };
  }
  if (!Number.isFinite(deltaGrams) || deltaGrams === 0) {
    return {
      requested,
      updated: 0,
      skipped: 0,
      error: "Geçerli bir gram değişimi girin",
    };
  }

  let updated = 0;
  let skipped = 0;

  for (const target of targets) {
    const next = Math.max(0, target.currentGrams + deltaGrams);
    const { data, error } = await supabase
      .from("material_colors")
      .update({ stock_grams: next })
      .eq("id", target.colorId)
      .eq("material_id", target.materialId)
      .select("id");
    if (error) {
      return { requested, updated, skipped, error: error.message };
    }
    if ((data ?? []).length) updated += 1;
    else skipped += 1;
  }

  return { requested, updated, skipped, error: null };
}
