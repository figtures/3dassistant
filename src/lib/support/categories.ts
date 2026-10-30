import type { SupportCategory } from "@/lib/support/types";

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  bridge: "Köprü / yazıcı",
  billing: "Fatura / abonelik",
  order: "Sipariş / iş",
  other: "Diğer",
};

export function getSupportCategoryLabel(category: string): string {
  if (category in SUPPORT_CATEGORY_LABELS) {
    return SUPPORT_CATEGORY_LABELS[category as SupportCategory];
  }
  return category;
}

export const SUPPORT_CATEGORY_OPTIONS = (
  Object.entries(SUPPORT_CATEGORY_LABELS) as [SupportCategory, string][]
).map(([value, label]) => ({ value, label }));
