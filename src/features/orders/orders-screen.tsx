"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/hooks/use-confirm";
import { useCustomers, useMachines } from "@/hooks/use-data";
import {
  Button,
  EmptyState,
  Input,
  Skeleton,
} from "@/components/ds";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import { OrderSheet } from "@/features/orders/order-sheet";
import {
  DEFAULT_PAGE_SIZE,
  ORDER_TABS,
  PAGE_SIZE_OPTIONS,
  type OrderTabId,
} from "@/features/orders/order-constants";
import { OrdersTable } from "@/features/orders/orders-table";
import { useOrders } from "@/features/orders/queries";
import {
  parseMultiParam,
  parseOrderTab,
} from "@/features/orders/order-utils";
import {
  deleteOrder,
  updateOrderStatus,
} from "@/features/orders/use-order-mutations";
import type { Job, JobStatus, PaymentStatus } from "@/types/database";
import { ClipboardList, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const selectClassName =
  "flex h-[var(--density-control-h)] rounded-lg border border-input bg-surface-inset px-3 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

const JOB_STATUSES: JobStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];
const PAYMENT_STATUSES: PaymentStatus[] = [
  "unpaid",
  "partial",
  "paid",
  "upcoming",
];

function OrdersV2Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const confirmAction = useConfirm();

  const tab = parseOrderTab(searchParams.get("tab"));
  const q = searchParams.get("q") ?? "";
  const machineId = searchParams.get("machine") ?? "";
  const customerId = searchParams.get("customer") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = parseInt(
    searchParams.get("size") ?? String(DEFAULT_PAGE_SIZE),
    10
  ) as (typeof PAGE_SIZE_OPTIONS)[number];
  const statusFilter = parseMultiParam(
    searchParams.get("status"),
    JOB_STATUSES
  ) as JobStatus[];
  const paymentFilter = parseMultiParam(
    searchParams.get("payment"),
    PAYMENT_STATUSES
  ) as PaymentStatus[];

  const orderParam = searchParams.get("order");
  const sheetOpen = orderParam != null && orderParam !== "";
  const sheetOrderId = orderParam === "new" ? "new" : orderParam;

  const [searchInput, setSearchInput] = useState(q);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const { data: machines = [] } = useMachines();
  const { data: customers = [] } = useCustomers();

  const { data, isLoading, isError, refetch } = useOrders({
    q,
    tab,
    status: statusFilter.length ? statusFilter : undefined,
    payment: paymentFilter.length ? paymentFilter : undefined,
    machineId: machineId || undefined,
    customerId: customerId || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const patchUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `/orders?${qs}` : "/orders", { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab, q, machineId, customerId, from, to, page, pageSize]);

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  function setTab(next: OrderTabId) {
    patchUrl({
      tab: next === "all" ? null : next,
      page: "1",
      status: null,
      payment: null,
    });
  }

  function openOrder(id: string) {
    patchUrl({ order: id });
  }

  function closeSheet() {
    patchUrl({ order: null });
  }

  async function handleDelete(job: Job) {
    const ok = await confirmAction({
      title: "Sipariş silinsin mi?",
      description: job.title ?? undefined,
      confirmLabel: "Sil",
      tone: "destructive",
    });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await deleteOrder(supabase, job.id);
    if (error) toast.error(error);
    else {
      toast.success("Sipariş silindi");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
  }

  async function handleStatusChange(job: Job, status: JobStatus) {
    const supabase = createClient();
    const { error } = await updateOrderStatus(supabase, job.id, status);
    if (error) toast.error(error);
    else {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    }
  }

  async function handleBulkStatus(status: JobStatus) {
    if (!selectedIds.size) return;
    const ok = await confirmAction({
      title: "Toplu durum değişikliği",
      description: `${selectedIds.size} siparişin durumu güncellenecek.`,
    });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("jobs")
      .update({ status })
      .in("id", [...selectedIds]);
    if (error) toast.error(error.message);
    else {
      toast.success(`${selectedIds.size} sipariş güncellendi`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    }
  }

  async function handleBulkDelete() {
    if (!selectedIds.size) return;
    const ok = await confirmAction({
      title: "Seçili siparişler silinsin mi?",
      description: `${selectedIds.size} kayıt kalıcı olarak silinecek.`,
      confirmLabel: "Sil",
      tone: "destructive",
    });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("jobs")
      .delete()
      .in("id", [...selectedIds]);
    if (error) toast.error(error.message);
    else {
      toast.success(`${selectedIds.size} sipariş silindi`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    }
  }

  const bulkBar = selectedIds.size > 0;

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <HelpTitleRow>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <ClipboardList className="size-6 text-primary" aria-hidden />
              Siparişler
            </h1>
          </HelpTitleRow>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Tüm siparişleri filtreleyin, durumlarını yönetin ve planlamayla
            senkron tutun.
          </p>
        </div>
        <Button type="button" onClick={() => openOrder("new")}>
          <Plus className="size-4" aria-hidden />
          Yeni sipariş
        </Button>
      </header>

      <div
        className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface-inset p-1"
        role="tablist"
        aria-label="Sipariş sekmeleri"
      >
        {ORDER_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-surface-raised text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onBlur={() => patchUrl({ q: searchInput.trim() || null, page: "1" })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                patchUrl({ q: searchInput.trim() || null, page: "1" });
              }
            }}
            placeholder="Başlıkta ara…"
            className="pl-9"
            aria-label="Sipariş ara"
          />
        </div>
        <select
          className={cn(selectClassName, "min-w-[140px]")}
          value={machineId}
          onChange={(e) =>
            patchUrl({ machine: e.target.value || null, page: "1" })
          }
          aria-label="Makine filtresi"
        >
          <option value="">Tüm makineler</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          className={cn(selectClassName, "min-w-[140px]")}
          value={customerId}
          onChange={(e) =>
            patchUrl({ customer: e.target.value || null, page: "1" })
          }
          aria-label="Müşteri filtresi"
        >
          <option value="">Tüm müşteriler</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Input
          type="date"
          value={from}
          onChange={(e) => patchUrl({ from: e.target.value || null, page: "1" })}
          className="w-full sm:w-auto"
          aria-label="Teslim başlangıç"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => patchUrl({ to: e.target.value || null, page: "1" })}
          className="w-full sm:w-auto"
          aria-label="Teslim bitiş"
        />
      </div>

      {bulkBar ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
          <span className="font-medium">{selectedIds.size} seçili</span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void handleBulkStatus("in_progress")}
          >
            Üretime al
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void handleBulkStatus("completed")}
          >
            Tamamla
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => void handleBulkDelete()}
          >
            Sil
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" aria-busy="true" />
      ) : isError ? (
        <div className="rounded-xl border border-border p-5" role="alert">
          <p className="text-sm">Liste yüklenemedi.</p>
          <Button type="button" size="sm" className="mt-3" onClick={() => refetch()}>
            Tekrar dene
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sipariş bulunamadı"
          description={
            q || machineId || customerId || tab !== "all"
              ? "Filtreleri temizleyerek tekrar deneyin."
              : "İlk siparişinizi oluşturun."
          }
          action={
            <Button type="button" onClick={() => openOrder("new")}>
              Yeni sipariş
            </Button>
          }
        />
      ) : (
        <>
          <OrdersTable
            rows={rows}
            selectedIds={selectedIds}
            onToggleSelect={(id) => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            onToggleSelectAll={() => {
              if (allSelected) setSelectedIds(new Set());
              else setSelectedIds(new Set(rows.map((r) => r.id)));
            }}
            allSelected={allSelected}
            onRowClick={(job) => openOrder(job.id)}
            onEdit={(job) => openOrder(job.id)}
            onDelete={(job) => void handleDelete(job)}
            onStatusChange={(job, status) => void handleStatusChange(job, status)}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Toplam {total} sipariş · Sayfa {page}/{totalPages}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={selectClassName}
                value={String(pageSize)}
                onChange={(e) =>
                  patchUrl({ size: e.target.value, page: "1" })
                }
                aria-label="Sayfa boyutu"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} / sayfa
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => patchUrl({ page: String(page - 1) })}
              >
                Önceki
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => patchUrl({ page: String(page + 1) })}
              >
                Sonraki
              </Button>
            </div>
          </div>
        </>
      )}

      <OrderSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
        orderId={sheetOrderId}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
        }}
      />
    </div>
  );
}

export function OrdersV2() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
      <OrdersV2Content />
    </Suspense>
  );
}
