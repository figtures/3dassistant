import type { Material, MaterialColor } from "@/types/database";

/** Varsayılan düşük stok eşiği (gram). */
export const DEFAULT_LOW_STOCK_GRAMS = 500;

export function lowStockThreshold(
  colorLowStockGrams?: number | null
): number {
  return colorLowStockGrams ?? DEFAULT_LOW_STOCK_GRAMS;
}

export function isLowStock(
  stockGrams: number | null | undefined,
  thresholdGrams: number = DEFAULT_LOW_STOCK_GRAMS
): boolean {
  return (stockGrams ?? 0) < thresholdGrams;
}

/** Son 30 günde günlük ortalama tüketim (gram/gün). Tüketim yoksa null. */
export function estimateDaysLeft(
  consumptionLast30dGrams: number,
  stockGrams: number | null | undefined
): number | null {
  if (consumptionLast30dGrams <= 0) return null;
  const stock = stockGrams ?? 0;
  if (stock <= 0) return 0;
  const daily = consumptionLast30dGrams / 30;
  if (daily <= 0) return null;
  return Math.max(0, Math.floor(stock / daily));
}

export type LowStockItem = {
  materialId: string;
  materialName: string;
  colorId: string;
  colorName: string;
  stockGrams: number;
  thresholdGrams: number;
  daysLeft: number | null;
};

export function collectLowStockItems(
  materials: Material[],
  consumptionByColorId: ReadonlyMap<string, number> = new Map()
): LowStockItem[] {
  const items: LowStockItem[] = [];
  for (const material of materials) {
    for (const color of material.material_colors ?? []) {
      const threshold = lowStockThreshold(color.low_stock_grams);
      if (!isLowStock(color.stock_grams, threshold)) continue;
      const consumption = consumptionByColorId.get(color.id) ?? 0;
      items.push({
        materialId: material.id,
        materialName: material.name,
        colorId: color.id,
        colorName: color.color_name,
        stockGrams: color.stock_grams ?? 0,
        thresholdGrams: threshold,
        daysLeft: estimateDaysLeft(consumption, color.stock_grams),
      });
    }
  }
  return items.sort((a, b) =>
    `${a.materialName} ${a.colorName}`.localeCompare(
      `${b.materialName} ${b.colorName}`,
      "tr"
    )
  );
}

export function consumptionByColorFromJobs(
  jobs: Array<{
    material_color_id: string | null;
    grams_used: number | null;
    created_at?: string;
    job_date?: string;
  }>,
  windowDays = 30,
  now = new Date()
): Map<string, number> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - windowDays);
  cutoff.setHours(0, 0, 0, 0);

  const totals = new Map<string, number>();
  for (const job of jobs) {
    if (!job.material_color_id) continue;
    const grams = job.grams_used ?? 0;
    if (grams <= 0) continue;
    const when = job.job_date ?? job.created_at;
    if (when) {
      const d = new Date(when);
      if (d < cutoff) continue;
    }
    totals.set(
      job.material_color_id,
      (totals.get(job.material_color_id) ?? 0) + grams
    );
  }
  return totals;
}
