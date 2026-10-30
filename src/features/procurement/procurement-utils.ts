import type { MaterialPurchase } from "@/types/database";
import type { SpendPeriod } from "@/features/procurement/procurement-constants";

function periodStartIso(period: SpendPeriod): string | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }
  if (period === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  return d.toISOString().slice(0, 10);
}

export function filterPurchasesByPeriod(
  purchases: MaterialPurchase[],
  period: SpendPeriod
): MaterialPurchase[] {
  const start = periodStartIso(period);
  if (!start) return purchases;
  return purchases.filter((p) => p.purchase_date >= start);
}

export function sumPurchaseTotals(purchases: MaterialPurchase[]): number {
  return purchases.reduce((s, p) => s + Number(p.total ?? 0), 0);
}
