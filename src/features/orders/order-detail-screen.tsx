"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@/components/ds";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import { Timeline } from "@/components/v2/timeline/timeline";
import type { TimelineEvent } from "@/components/v2/timeline/timeline";
import { OrderSheet } from "@/features/orders/order-sheet";
import { OrderStatusBadge } from "@/features/orders/order-status-badge";
import { PaymentStatusBadge } from "@/features/orders/payment-status-badge";
import { buildOrderTimelineEvents } from "@/features/orders/order-timeline";
import { useOrderById } from "@/features/orders/queries";
import { updateOrderStatus } from "@/features/orders/use-order-mutations";
import { useBreadcrumbLabel } from "@/hooks/use-breadcrumb-label";
import {
  formatDate,
  formatDateShort,
  todayIsoInIstanbul,
} from "@/lib/format";
import type { Job, JobStatus } from "@/types/database";
import { ArrowLeft, CalendarClock, FileText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency, formatDuration, formatGrams } from "@/lib/utils";

export type OrderDetailScreenProps = {
  orderId: string;
};

function deliveryCountdownLabel(
  deliveryDate: string | null,
  status: JobStatus
): { text: string; tone: "neutral" | "warning" | "danger" } | null {
  if (!deliveryDate || status === "completed" || status === "cancelled") {
    return null;
  }
  const today = todayIsoInIstanbul();
  const diff = differenceInCalendarDays(
    parseISO(deliveryDate.slice(0, 10)),
    parseISO(today)
  );
  if (diff > 0) return { text: `${diff} gün kaldı`, tone: "neutral" };
  if (diff === 0) return { text: "Bugün teslim", tone: "warning" };
  return { text: `${Math.abs(diff)} gün gecikti`, tone: "danger" };
}

function computeMaterialCost(job: Job): number {
  const grams = job.grams_used ?? 0;
  const pricePerKg = job.material?.price_per_kg ?? 0;
  if (!grams || !pricePerKg) return 0;
  return (grams / 1000) * pricePerKg;
}

export function OrderDetailScreen({ orderId }: OrderDetailScreenProps) {
  const queryClient = useQueryClient();
  const { data: job, isLoading, isError, refetch } = useOrderById(orderId);
  const [now, setNow] = useState(() => Date.now());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [statusPending, setStatusPending] = useState(false);

  useBreadcrumbLabel(orderId, job?.title ?? undefined);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const timelineEvents = useMemo((): TimelineEvent[] => {
    if (!job) return [];
    return buildOrderTimelineEvents(job).map((event) => ({
      id: event.id,
      at: event.at,
      title: event.title,
      meta: event.meta,
      tone: event.tone,
      detail: event.detail ? (
        <span>{event.detail}</span>
      ) : undefined,
      icon: <FileText className="size-3.5" aria-hidden />,
    }));
  }, [job]);

  const costs = useMemo(() => {
    if (!job) return null;
    const materialCost = computeMaterialCost(job);
    const revenue = job.revenue_amount ?? 0;
    const profit = revenue - materialCost;
    return { materialCost, revenue, profit };
  }, [job]);

  const setOptimisticStatus = useCallback(
    (status: JobStatus) => {
      queryClient.setQueryData<Job>(["order", orderId], (prev) =>
        prev ? { ...prev, status, updated_at: new Date().toISOString() } : prev
      );
    },
    [queryClient, orderId]
  );

  async function handleStatusChange(status: JobStatus) {
    if (!job || job.status === status) return;
    setStatusPending(true);
    const previous = job.status;
    setOptimisticStatus(status);
    const supabase = createClient();
    const { error } = await updateOrderStatus(supabase, job.id, status);
    setStatusPending(false);
    if (error) {
      setOptimisticStatus(previous);
      toast.error(error);
      return;
    }
    toast.success("Durum güncellendi");
    void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
    void queryClient.invalidateQueries({ queryKey: ["jobs"] });
  }

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8 print:hidden">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] print:grid-cols-1">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="space-y-4 pb-8">
        <Link
          href="/orders"
          className="inline-flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Siparişlere dön
        </Link>
        <EmptyState
          title="Sipariş bulunamadı"
          description="Kayıt silinmiş veya erişiminiz olmayabilir."
          action={
            <Button type="button" variant="secondary" onClick={() => void refetch()}>
              Tekrar dene
            </Button>
          }
        />
      </div>
    );
  }

  const title = job.title ?? "Sipariş";
  const delivery = deliveryCountdownLabel(job.delivery_date, job.status);
  const colorHex = job.material_color?.hex_code;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link
          href="/orders"
          className="-ml-2 inline-flex h-8 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Siparişlere dön
        </Link>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setSheetOpen(true)}
        >
          <Pencil className="size-4" aria-hidden />
          Düzenle
        </Button>
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <HelpTitleRow>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
            </HelpTitleRow>
            <p className="text-sm text-muted-foreground">
              {job.customer ? (
                <>
                  Müşteri:{" "}
                  <Link
                    href={`/customers/${job.customer_id}`}
                    className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                  >
                    {job.customer.name}
                  </Link>
                </>
              ) : (
                "Müşteri atanmadı"
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={job.status} />
            <PaymentStatusBadge status={job.payment_status} />
          </div>
        </div>
        {delivery ? (
          <p
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium",
              delivery.tone === "danger" &&
                "bg-destructive-subtle text-destructive",
              delivery.tone === "warning" &&
                "bg-warning-subtle text-warning-foreground",
              delivery.tone === "neutral" && "bg-surface-inset text-foreground"
            )}
          >
            <CalendarClock className="size-4 shrink-0" aria-hidden />
            Teslim:{" "}
            {job.delivery_date
              ? formatDateShort(job.delivery_date)
              : "—"}{" "}
            · {delivery.text}
          </p>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2 print:hidden">
        {job.status === "pending" ? (
          <Button
            type="button"
            loading={statusPending}
            onClick={() => void handleStatusChange("in_progress")}
          >
            Üretime al
          </Button>
        ) : null}
        {job.status === "in_progress" ? (
          <Button
            type="button"
            loading={statusPending}
            onClick={() => void handleStatusChange("completed")}
          >
            Tamamla
          </Button>
        ) : null}
        {job.status !== "cancelled" && job.status !== "completed" ? (
          <Button
            type="button"
            variant="secondary"
            loading={statusPending}
            onClick={() => void handleStatusChange("cancelled")}
          >
            İptal
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] print:grid-cols-1">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Üretim</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Makine</p>
                <p className="font-medium">{job.machine?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Baskı tarihi</p>
                <p className="font-medium">{formatDateShort(job.job_date)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Malzeme</p>
                <p className="flex items-center gap-2 font-medium">
                  {colorHex ? (
                    <span
                      className="inline-block size-3 rounded-full ring-1 ring-border"
                      style={{ backgroundColor: colorHex }}
                      aria-hidden
                    />
                  ) : null}
                  {job.material?.name ?? "—"}
                  {job.material_color?.color_name
                    ? ` · ${job.material_color.color_name}`
                    : ""}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Gram / süre</p>
                <p className="font-medium tabular-nums">
                  {formatGrams(job.grams_used)} ·{" "}
                  {formatDuration(job.duration_minutes)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Maliyet ve kâr</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground">Malzeme maliyeti</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(costs?.materialCost ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  kg fiyatı × gram
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Ciro</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(costs?.revenue ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Tahmini kâr</p>
                <p
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    (costs?.profit ?? 0) < 0 && "text-destructive"
                  )}
                >
                  {formatCurrency(costs?.profit ?? 0)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ödeme</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Tutar / ödenen</p>
                <p className="font-medium tabular-nums">
                  {formatCurrency(job.revenue_amount)} ·{" "}
                  {formatCurrency(job.amount_paid)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Kalan</p>
                <p className="font-medium tabular-nums">
                  {formatCurrency(job.amount_remaining)}
                </p>
              </div>
              {job.payment_due_date ? (
                <div>
                  <p className="text-muted-foreground">Vade</p>
                  <p className="font-medium">
                    {formatDate(job.payment_due_date)}
                  </p>
                </div>
              ) : null}
              {job.installment_count && job.installment_count > 1 ? (
                <div>
                  <p className="text-muted-foreground">Taksitler</p>
                  <p className="font-medium tabular-nums">
                    {job.installment_count} ×{" "}
                    {formatCurrency(job.installment_amount)}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {job.description ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Açıklama</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {job.description}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="print:break-inside-avoid">
          <CardHeader>
            <CardTitle className="text-base">Zaman çizelgesi</CardTitle>
          </CardHeader>
          <CardContent>
            {timelineEvents.length ? (
              <Timeline
                events={timelineEvents}
                now={now}
                label="Sipariş geçmişi"
                maxHeight={520}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <OrderSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        orderId={orderId}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
        }}
      />

    </div>
  );
}
