import type { JobStatus, PaymentStatus } from "@/types/database";

export const ORDER_STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Bekliyor",
  in_progress: "Üretimde",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Ödenmedi",
  partial: "Kısmi",
  paid: "Ödendi",
  upcoming: "Ödeme bekleniyor",
};

export type OrderTabId =
  | "all"
  | "pending"
  | "in_progress"
  | "overdue"
  | "payment";

export const ORDER_TABS: { id: OrderTabId; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "pending", label: "Bekleyen" },
  { id: "in_progress", label: "Üretimde" },
  { id: "overdue", label: "Geciken" },
  { id: "payment", label: "Ödeme bekleyen" },
];

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = 25;
