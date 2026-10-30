import type { LucideIcon } from "lucide-react";
import {
  Cpu,
  LifeBuoy,
  MessageCircleWarning,
  Monitor,
  PlusCircle,
} from "lucide-react";
import { NAV_ITEMS, groupNavItems, type GroupNavOptions } from "@/lib/nav";

export const NAV_SEARCH_KEYWORDS: Record<string, string[]> = {
  dashboard: ["genel", "özet", "ana"],
  planning: ["plan", "iş", "sipariş", "üretim"],
  calendar: ["takvim", "teslim", "termin"],
  machines: ["yazıcı", "printer", "cihaz", "filo"],
  faults: ["arıza", "hata"],
  materials: ["filament", "malzeme", "stok", "hammadde"],
  procurement: ["satın", "tedarik", "alım"],
  catalog: ["ürün", "sku", "model"],
  customers: ["müşteri", "client"],
  billing: ["fatura", "abonelik", "ödeme", "plan"],
  support: ["yardım", "destek", "ticket"],
  "support-admin": ["destek yönetimi", "admin"],
};

export type QuickAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
  hint?: string;
  kind: "route" | "report" | "ui-v1";
  href?: string;
};

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "new-order",
    label: "Yeni sipariş",
    icon: PlusCircle,
    keywords: ["sipariş", "order", "yeni"],
    hint: "Planlamaya git (geçici)",
    kind: "route",
    href: "/planning",
  },
  {
    id: "machines",
    label: "Makineler",
    icon: Cpu,
    keywords: ["yazıcı", "filo"],
    kind: "route",
    href: "/machines",
  },
  {
    id: "support",
    label: "Destek",
    icon: LifeBuoy,
    keywords: ["yardım"],
    kind: "route",
    href: "/support",
  },
  {
    id: "report",
    label: "Sorun bildir",
    icon: MessageCircleWarning,
    keywords: ["hata", "bug", "geri bildirim"],
    kind: "report",
  },
  {
    id: "ui-v1",
    label: "Eski görünüme dön",
    icon: Monitor,
    keywords: ["legacy", "v1", "klasik"],
    hint: "Klasik arayüze geç",
    kind: "ui-v1",
    href: "/?ui=v1",
  },
];

export function getVisibleNavItems(opts?: GroupNavOptions) {
  return groupNavItems(NAV_ITEMS, opts).flatMap((g) => g.items);
}

export function navItemKeywords(itemId: string, label: string): string[] {
  const extra = NAV_SEARCH_KEYWORDS[itemId] ?? [];
  return [label, ...extra];
}
