"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCustomers, useCustomerJobs, formatDateTR } from "@/hooks/use-data";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@/components/ds";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import { formatCurrency, formatDuration, formatGrams } from "@/lib/utils";
import { formatCurrency as formatCurrencyV2, formatDate } from "@/lib/format";
import { buildCustomerStatsMap } from "@/features/customers/customer-utils";
import { usePermission } from "@/components/workspace/can";
import {
  ArrowLeft,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Printer,
} from "lucide-react";
import type { JobStatus, PaymentStatus } from "@/types/database";

const STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Bekliyor",
  in_progress: "Üretimde",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Ödenmedi",
  partial: "Kısmi",
  paid: "Ödendi",
  upcoming: "Bekleyen",
};

function paymentTone(status: PaymentStatus | undefined): "success" | "warning" | "neutral" {
  if (status === "paid") return "success";
  if (status === "partial" || status === "upcoming") return "warning";
  return "neutral";
}

export type CustomerDetailScreenProps = {
  customerId: string;
};

export function CustomerDetailScreen({ customerId }: CustomerDetailScreenProps) {
  const showFinance = usePermission("finance.view");
  const canExport = usePermission("export.data");
  const { data: customers = [], isLoading: customersLoading } = useCustomers();
  const { data: jobs = [], isLoading: jobsLoading } = useCustomerJobs(customerId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const customer = customers.find((c) => c.id === customerId);
  const referrer = customer?.referred_by_customer_id
    ? customers.find((c) => c.id === customer.referred_by_customer_id)
    : null;

  const stats = useMemo(() => {
    const map = buildCustomerStatsMap(jobs);
    return (
      map.get(customerId) ?? {
        orderCount: 0,
        totalRevenue: 0,
        pendingCollection: 0,
        lastOrderDate: null,
      }
    );
  }, [jobs, customerId]);

  const isLoading = customersLoading || jobsLoading;

  function toggleJob(jobId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-4 pb-8">
        <Link
          href="/customers"
          className="inline-flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Müşterilere dön
        </Link>
        <EmptyState
          title="Müşteri bulunamadı"
          description="Kayıt silinmiş veya erişiminiz olmayabilir."
          action={
            <Link
              href="/customers"
              className="inline-flex h-[var(--density-control-h)] items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              Listeye dön
            </Link>
          }
        />
      </div>
    );
  }

  const subtitle = [customer.company, customer.email, customer.phone]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6 pb-8">
      <div className="pf-print-only pf-print-header">
        <h1>Müşteri ekstresi</h1>
        <p>
          {customer.name} · {formatDate(new Date().toISOString())}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link
          href="/customers"
          className="-ml-2 inline-flex h-8 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Müşterilere dön
        </Link>
        {canExport || showFinance ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden />
            Ekstre yazdır
          </Button>
        ) : null}
      </div>

      <header className="space-y-1 print:hidden">
        <HelpTitleRow>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{customer.name}</h1>
        </HelpTitleRow>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </header>

      <div className={`grid gap-4 ${showFinance ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}>
        {showFinance ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Toplam ciro</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {formatCurrencyV2(stats.totalRevenue)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Bekleyen tahsilat
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {formatCurrencyV2(stats.pendingCollection)}
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sipariş sayısı</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{stats.orderCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Kaynak ve referans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Kaynak: </span>
              <span className="text-foreground">{customer.source ?? "—"}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Referans: </span>
              <span className="text-foreground">{customer.referral ?? "—"}</span>
            </p>
            {referrer ? (
              <p>
                <span className="text-muted-foreground">Yönlendiren: </span>
                <Link
                  href={`/customers/${referrer.id}`}
                  className="font-medium text-primary hover:text-primary-hover"
                >
                  {referrer.name}
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>
        {customer.notes ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Notlar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground">{customer.notes}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <section aria-labelledby="customer-jobs-heading" className="print:hidden">
        <h2
          id="customer-jobs-heading"
          className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground"
        >
          <Briefcase className="size-4 text-primary" aria-hidden />
          Siparişler
        </h2>

        {jobs.length === 0 ? (
          <EmptyState
            title="Henüz sipariş yok"
            description="Planlama veya siparişler ekranından bu müşteriye iş atayabilirsiniz."
            action={
              <Link
                href="/planning"
                className="inline-flex h-[var(--density-control-h)] items-center justify-center rounded-lg border border-border bg-surface-2 px-4 text-sm font-medium text-foreground hover:bg-surface-3 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
              >
                Planlamaya git
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => {
              const isOpen = expanded.has(job.id);
              const notes = job.job_notes ?? [];
              return (
                <Card key={job.id} className="overflow-hidden py-0">
                  <button
                    type="button"
                    onClick={() => toggleJob(job.id)}
                    className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left text-sm hover:bg-surface-2/50 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                    aria-expanded={isOpen}
                  >
                    {isOpen ? (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                      {formatDateTR(job.job_date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                      {job.title ?? "—"}
                    </span>
                    <span className="text-muted-foreground">{formatDuration(job.duration_minutes)}</span>
                    {showFinance ? (
                      <>
                        <span className="tabular-nums text-foreground">
                          {formatCurrency(job.revenue_amount)}
                        </span>
                        <Badge tone={paymentTone(job.payment_status ?? "unpaid")}>
                          {PAYMENT_LABELS[job.payment_status ?? "unpaid"]}
                        </Badge>
                      </>
                    ) : null}
                    <Badge tone={job.status === "completed" ? "success" : "neutral"}>
                      {STATUS_LABELS[job.status]}
                    </Badge>
                  </button>
                  {isOpen ? (
                    <div className="space-y-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <p>
                          <span className="text-muted-foreground">Makine: </span>
                          {job.machine?.name ?? "—"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Malzeme: </span>
                          {job.material?.name ?? "—"}
                          {job.material_color?.color_name
                            ? ` (${job.material_color.color_name})`
                            : ""}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Gram: </span>
                          {formatGrams(job.grams_used)}
                        </p>
                        {showFinance ? (
                          <p>
                            <span className="text-muted-foreground">Ödenen / Kalan: </span>
                            {formatCurrency(job.amount_paid)} / {formatCurrency(job.amount_remaining)}
                          </p>
                        ) : null}
                      </div>
                      {notes.length > 0 ? (
                        <div>
                          <p className="mb-1 text-xs text-muted-foreground">İş notları</p>
                          <ul className="space-y-1">
                            {notes.map((n) => (
                              <li
                                key={n.id}
                                className="rounded-lg border border-border bg-surface-inset px-3 py-2 text-xs text-foreground"
                              >
                                {n.is_voice ? (
                                  <span className="mr-1 text-primary">[Ses]</span>
                                ) : null}
                                {n.content}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs">Bu sipariş için not kaydı yok.</p>
                      )}
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {jobs.length > 0 ? (
        <div className="pf-print-only">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-left">
                <th className="py-2 pr-2">Tarih</th>
                <th className="py-2 pr-2">Sipariş</th>
                <th className="py-2 pr-2">Durum</th>
                {showFinance ? (
                  <>
                    <th className="py-2 pr-2">Tutar</th>
                    <th className="py-2 pr-2">Ödeme</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-gray-200">
                  <td className="py-2 pr-2 tabular-nums">{formatDateTR(job.job_date)}</td>
                  <td className="py-2 pr-2">{job.title ?? "—"}</td>
                  <td className="py-2 pr-2">{STATUS_LABELS[job.status]}</td>
                  {showFinance ? (
                    <>
                      <td className="py-2 pr-2 tabular-nums">
                        {formatCurrency(job.revenue_amount)}
                      </td>
                      <td className="py-2 pr-2">
                        {PAYMENT_LABELS[job.payment_status ?? "unpaid"]}
                      </td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
