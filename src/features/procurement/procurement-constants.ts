export const PROCUREMENT_CHANNELS = [
  "Trendyol",
  "Hepsiburada",
  "Amazon",
  "N11",
  "Direkt",
  "Diğer",
] as const;

export type ProcurementTab = "purchases" | "suppliers";

export type SpendPeriod = "all" | "7d" | "30d" | "month";

export const SPEND_PERIOD_LABELS: Record<SpendPeriod, string> = {
  all: "Tümü",
  "7d": "Son 7 gün",
  "30d": "Son 30 gün",
  month: "Bu ay",
};
