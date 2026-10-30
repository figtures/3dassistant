"use client";

import Link from "next/link";
import { Button, Card, CardContent } from "@/components/ds";
import { formatCurrency, formatDateShort } from "@/lib/format";
import type { Customer } from "@/types/database";
import { Eye, Pencil, Trash2 } from "lucide-react";
import {
  formatContactLine,
  type CustomerStats,
} from "@/features/customers/customer-utils";

export type CustomersTableProps = {
  customers: Customer[];
  statsMap: Map<string, CustomerStats>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

export function CustomersTable({
  customers,
  statsMap,
  onEdit,
  onDelete,
}: CustomersTableProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="sticky top-0 z-[1] bg-surface-2">
              <tr className="border-b border-border text-left text-muted-foreground">
                {["Ad", "Firma", "İletişim", "Sipariş", "Toplam ciro", "Son sipariş", ""].map(
                  (h) => (
                    <th key={h || "actions"} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const stats = statsMap.get(c.id);
                return (
                  <tr
                    key={c.id}
                    className="border-b border-border/60 transition-colors hover:bg-surface-2/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/customers/${c.id}`}
                        className="font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.company ?? "—"}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                      {formatContactLine(c)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {stats?.orderCount ?? 0}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {formatCurrency(stats?.totalRevenue ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {stats?.lastOrderDate ? formatDateShort(stats.lastOrderDate) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-0.5">
                        <Link
                          href={`/customers/${c.id}`}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                          aria-label={`${c.name} detayı`}
                        >
                          <Eye className="size-4" />
                        </Link>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(c.id)}
                          aria-label={`${c.name} düzenle`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(c.id)}
                          aria-label={`${c.name} sil`}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {customers.map((c) => {
          const stats = statsMap.get(c.id);
          return (
            <Card key={c.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/customers/${c.id}`}
                      className="font-semibold text-foreground hover:text-primary"
                    >
                      {c.name}
                    </Link>
                    {c.company ? (
                      <p className="text-sm text-muted-foreground">{c.company}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">{formatContactLine(c)}</p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(c.id)}
                      aria-label={`${c.name} düzenle`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(c.id)}
                      aria-label={`${c.name} sil`}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Sipariş</dt>
                    <dd className="tabular-nums font-medium text-foreground">
                      {stats?.orderCount ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Ciro</dt>
                    <dd className="tabular-nums font-medium text-foreground">
                      {formatCurrency(stats?.totalRevenue ?? 0)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
