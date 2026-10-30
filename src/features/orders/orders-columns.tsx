/** Sipariş tablosu sütun tanımları (OrdersTable ile hizalı). */
export const ORDERS_COLUMN_IDS = [
  "select",
  "order",
  "status",
  "machine",
  "material",
  "grams",
  "delivery",
  "amount",
  "payment",
  "remaining",
  "actions",
] as const;

export type OrdersColumnId = (typeof ORDERS_COLUMN_IDS)[number];

export const ORDERS_COLUMN_LABELS: Record<OrdersColumnId, string> = {
  select: "",
  order: "Sipariş",
  status: "Durum",
  machine: "Makine",
  material: "Malzeme",
  grams: "Gram",
  delivery: "Teslim tarihi",
  amount: "Tutar",
  payment: "Ödeme durumu",
  remaining: "Kalan",
  actions: "",
};
