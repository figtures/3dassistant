import type { CustomerStats } from "@/features/customers/customer-utils";
import { formatContactLine } from "@/features/customers/customer-utils";
import type { ExportColumn } from "@/lib/export/types";
import type { Customer } from "@/types/database";

export type CustomerExportRow = Customer & { stats: CustomerStats };

export const CUSTOMERS_EXPORT_COLUMN_IDS = [
  "name",
  "company",
  "contact",
  "orders",
  "revenue",
  "lastOrder",
] as const;

export function buildCustomersExportColumns(options: {
  showFinance: boolean;
}): ExportColumn<CustomerExportRow>[] {
  const cols: ExportColumn<CustomerExportRow>[] = [
    {
      id: "name",
      header: "Ad",
      getValue: (c) => c.name,
    },
    {
      id: "company",
      header: "Firma",
      getValue: (c) => c.company ?? "",
    },
    {
      id: "contact",
      header: "İletişim",
      getValue: (c) => formatContactLine(c),
    },
    {
      id: "orders",
      header: "Sipariş",
      kind: "number",
      getValue: (c) => c.stats.orderCount,
    },
  ];

  if (options.showFinance) {
    cols.push({
      id: "revenue",
      header: "Toplam ciro",
      kind: "currency",
      getValue: (c) => c.stats.totalRevenue,
    });
  }

  cols.push({
    id: "lastOrder",
    header: "Son sipariş",
    kind: "date",
    getValue: (c) => c.stats.lastOrderDate ?? "",
  });

  return cols;
}
