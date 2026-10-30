"use client";

import { Button, Card, CardContent } from "@/components/ds";
import { OrderStatusBadge } from "@/features/orders/order-status-badge";
import { PaymentStatusBadge } from "@/features/orders/payment-status-badge";
import { overdueDays } from "@/features/orders/order-utils";
import { formatCurrency, formatDateShort, formatGrams } from "@/lib/format";
import type { Job, JobStatus } from "@/types/database";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type OrdersTableProps = {
  rows: Job[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  onRowClick: (job: Job) => void;
  onEdit: (job: Job) => void;
  onDelete: (job: Job) => void;
  onStatusChange: (job: Job, status: JobStatus) => void;
};

export function OrdersTable({
  rows,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  onRowClick,
  onEdit,
  onDelete,
  onStatusChange,
}: OrdersTableProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="sticky top-0 z-[1] bg-surface-2">
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleSelectAll}
                    aria-label="Tümünü seç"
                    className="size-4 rounded border-border"
                  />
                </th>
                {[
                  "Sipariş",
                  "Durum",
                  "Makine",
                  "Malzeme",
                  "Gram",
                  "Teslim",
                  "Tutar",
                  "Ödeme",
                  "Kalan",
                  "",
                ].map((h) => (
                  <th key={h || "actions"} className="px-3 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((job) => {
                const overdue = overdueDays(job);
                const isLate =
                  job.delivery_date &&
                  overdue > 0 &&
                  job.status !== "completed" &&
                  job.status !== "cancelled";
                return (
                  <tr
                    key={job.id}
                    className={cn(
                      "cursor-pointer border-b border-border/60 transition-colors hover:bg-surface-2/50",
                      selectedIds.has(job.id) && "bg-primary-subtle/30"
                    )}
                    onClick={() => onRowClick(job)}
                  >
                    <td
                      className="px-3 py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(job.id)}
                        onChange={() => onToggleSelect(job.id)}
                        aria-label={`${job.title ?? "Sipariş"} seç`}
                        className="size-4 rounded border-border"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">
                        {job.title ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {job.customer?.name ?? "Müşteri yok"}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <OrderStatusBadge status={job.status} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {job.machine?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {job.material_color?.hex_code ? (
                          <span
                            className="size-3 rounded-full border border-border"
                            style={{ backgroundColor: job.material_color.hex_code }}
                            aria-hidden
                          />
                        ) : null}
                        <span className="text-muted-foreground">
                          {[job.material?.name, job.material_color?.color_name]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {job.grams_used != null ? formatGrams(job.grams_used) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {job.delivery_date ? (
                        <div>
                          <span
                            className={cn(
                              isLate && "font-medium text-destructive"
                            )}
                          >
                            {formatDateShort(job.delivery_date)}
                          </span>
                          {isLate ? (
                            <div className="text-xs text-destructive">
                              {overdue} gün gecikti
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatCurrency(job.revenue_amount ?? 0)}
                    </td>
                    <td className="px-3 py-2">
                      <PaymentStatusBadge status={job.payment_status} />
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {formatCurrency(job.amount_remaining ?? 0)}
                    </td>
                    <td
                      className="px-3 py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <RowActions
                        job={job}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onStatusChange={onStatusChange}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((job) => (
          <Card
            key={job.id}
            className="cursor-pointer"
            onClick={() => onRowClick(job)}
          >
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">
                    {job.title ?? "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {job.customer?.name ?? "Müşteri yok"}
                  </p>
                </div>
                <OrderStatusBadge status={job.status} />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Makine</dt>
                  <dd>{job.machine?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Teslim</dt>
                  <dd>{job.delivery_date ? formatDateShort(job.delivery_date) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tutar</dt>
                  <dd className="tabular-nums">
                    {formatCurrency(job.revenue_amount ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Ödeme</dt>
                  <dd>
                    <PaymentStatusBadge status={job.payment_status} />
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function RowActions({
  job,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  job: Job;
  onEdit: (job: Job) => void;
  onDelete: (job: Job) => void;
  onStatusChange: (job: Job, status: JobStatus) => void;
}) {
  return (
    <div className="flex justify-end gap-0.5">
      <details className="relative">
        <summary
          className="inline-flex size-9 cursor-pointer list-none items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          aria-label={`${job.title ?? "Sipariş"} eylemleri`}
        >
          <MoreHorizontal className="size-4" />
        </summary>
        <div className="absolute right-0 z-10 mt-1 min-w-[160px] rounded-lg border border-border bg-popover p-1 shadow-e3">
          <button
            type="button"
            className="flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => onEdit(job)}
          >
            Düzenle
          </button>
          <button
            type="button"
            className="flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => onStatusChange(job, "in_progress")}
          >
            Üretime al
          </button>
          <button
            type="button"
            className="flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => onStatusChange(job, "completed")}
          >
            Tamamla
          </button>
          <button
            type="button"
            className="flex w-full rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-accent"
            onClick={() => onDelete(job)}
          >
            Sil
          </button>
        </div>
      </details>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onEdit(job)}
        aria-label={`${job.title ?? "Sipariş"} düzenle`}
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onDelete(job)}
        aria-label={`${job.title ?? "Sipariş"} sil`}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
