import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/features/orders/order-constants";
import type { ExportColumn } from "@/lib/export/types";
import type { Job } from "@/types/database";

export const ORDERS_EXPORT_COLUMN_IDS = [
  "order",
  "status",
  "machine",
  "material",
  "grams",
  "delivery",
  "amount",
  "payment",
  "remaining",
] as const;

export type OrdersExportColumnId = (typeof ORDERS_EXPORT_COLUMN_IDS)[number];

export function buildOrdersExportColumns(options: {
  showFinance: boolean;
}): ExportColumn<Job>[] {
  const cols: ExportColumn<Job>[] = [
    {
      id: "order",
      header: "Sipariş",
      getValue: (j) => {
        const title = j.title?.trim() ?? "";
        const customer = j.customer?.name?.trim() ?? "";
        if (title && customer) return `${title} — ${customer}`;
        return title || customer;
      },
    },
    {
      id: "status",
      header: "Durum",
      getValue: (j) => ORDER_STATUS_LABELS[j.status],
    },
    {
      id: "machine",
      header: "Makine",
      getValue: (j) => j.machine?.name ?? "",
    },
    {
      id: "material",
      header: "Malzeme",
      getValue: (j) => {
        const mat = j.material?.name ?? "";
        const color = j.material_color?.color_name;
        return color ? `${mat} · ${color}` : mat;
      },
    },
    {
      id: "grams",
      header: "Gram",
      kind: "number",
      getValue: (j) => j.grams_used ?? "",
    },
    {
      id: "delivery",
      header: "Teslim tarihi",
      kind: "date",
      getValue: (j) => j.delivery_date ?? "",
    },
  ];

  if (options.showFinance) {
    cols.push(
      {
        id: "amount",
        header: "Tutar",
        kind: "currency",
        getValue: (j) => j.revenue_amount ?? 0,
      },
      {
        id: "payment",
        header: "Ödeme durumu",
        getValue: (j) => PAYMENT_STATUS_LABELS[j.payment_status],
      },
      {
        id: "remaining",
        header: "Kalan",
        kind: "currency",
        getValue: (j) => j.amount_remaining ?? 0,
      }
    );
  }

  return cols;
}
