/** Varsayılan düşük stok eşiği (gram). P2-06 renk başına kişiselleştirme ekler. */
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
