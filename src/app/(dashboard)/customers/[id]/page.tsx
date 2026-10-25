"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useCustomers, useCustomerJobs, formatDateTR } from "@/hooks/use-data";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDuration, formatGrams } from "@/lib/utils";
import { ArrowLeft, Briefcase, ChevronDown, ChevronRight } from "lucide-react";
import type { JobStatus, PaymentStatus } from "@/types/database";

const STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Bekliyor",
  in_progress: "Devam Ediyor",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Ödenmedi",
  partial: "Kısmi",
  paid: "Ödendi",
  upcoming: "Bekleyen",
};

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: customers = [], isLoading: customersLoading } = useCustomers();
  const { data: jobs = [], isLoading: jobsLoading } = useCustomerJobs(id);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const customer = customers.find((c) => c.id === id);
  const referrer = customer?.referred_by_customer_id
    ? customers.find((c) => c.id === customer.referred_by_customer_id)
    : null;
  const isLoading = customersLoading || jobsLoading;

  function toggleJob(jobId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  if (isLoading) return <PageLoader />;

  if (!customer) {
    return (
      <div className="space-y-4">
        <Link href="/customers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> Müşterilere dön
          </Button>
        </Link>
        <p className="text-zinc-500">Müşteri bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link href="/customers">
        <Button variant="ghost" size="sm" className="mb-2">
          <ArrowLeft className="h-4 w-4" /> Müşterilere dön
        </Button>
      </Link>

      <PageHeader
        title={customer.name}
        description={[customer.company, customer.email, customer.phone].filter(Boolean).join(" · ") || "Müşteri detayı"}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <p className="text-xs text-zinc-500">Kaynak</p>
          <p className="mt-1 font-medium text-zinc-200">{customer.source ?? "—"}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs text-zinc-500">Referans</p>
          <p className="mt-1 font-medium text-zinc-200">{customer.referral ?? "—"}</p>
          {referrer && (
            <Link
              href={`/customers/${referrer.id}`}
              className="mt-1 block text-xs text-sky-400 hover:underline"
            >
              Yönlendiren: {referrer.name}
            </Link>
          )}
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs text-zinc-500">Toplam iş</p>
          <p className="mt-1 font-medium text-zinc-200">{jobs.length}</p>
        </div>
      </div>

      {customer.notes && (
        <div className="glass rounded-2xl p-5">
          <p className="text-xs text-zinc-500">Notlar</p>
          <p className="mt-1 text-sm text-zinc-300">{customer.notes}</p>
        </div>
      )}

      <div>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
          <Briefcase className="h-4 w-4 text-sky-400" />
          İş geçmişi ve zaman kaydı
        </h2>

        {jobs.length === 0 ? (
          <p className="text-sm text-zinc-500">Bu müşteriye ait iş emri yok.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => {
              const isOpen = expanded.has(job.id);
              const notes = job.job_notes ?? [];
              return (
                <div key={job.id} className="glass overflow-hidden rounded-2xl">
                  <button
                    type="button"
                    onClick={() => toggleJob(job.id)}
                    className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left text-sm hover:bg-zinc-900/40"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                    )}
                    <span className="text-zinc-400 w-24 shrink-0">{formatDateTR(job.job_date)}</span>
                    <span className="min-w-0 flex-1 font-medium text-zinc-200 truncate">
                      {job.title ?? "—"}
                    </span>
                    <span className="text-zinc-500">{formatDuration(job.duration_minutes)}</span>
                    <span className="text-zinc-300">{formatCurrency(job.revenue_amount)}</span>
                    <Badge variant={job.payment_status === "paid" ? "success" : "default"}>
                      {PAYMENT_LABELS[job.payment_status ?? "unpaid"]}
                    </Badge>
                    <Badge variant={job.status === "completed" ? "success" : "default"}>
                      {STATUS_LABELS[job.status]}
                    </Badge>
                  </button>
                  {isOpen && (
                    <div className="border-t border-zinc-800/60 px-4 py-3 text-sm text-zinc-400 space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <p>
                          <span className="text-zinc-500">Makine: </span>
                          {job.machine?.name ?? "—"}
                        </p>
                        <p>
                          <span className="text-zinc-500">Malzeme: </span>
                          {job.material?.name ?? "—"}
                          {job.material_color?.color_name ? ` (${job.material_color.color_name})` : ""}
                        </p>
                        <p>
                          <span className="text-zinc-500">Gram: </span>
                          {formatGrams(job.grams_used)}
                        </p>
                        <p>
                          <span className="text-zinc-500">Ödenen / Kalan: </span>
                          {formatCurrency(job.amount_paid)} / {formatCurrency(job.amount_remaining)}
                        </p>
                      </div>
                      {notes.length > 0 ? (
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">İş notları</p>
                          <ul className="space-y-1">
                            {notes.map((n) => (
                              <li key={n.id} className="rounded-lg bg-zinc-950/50 px-3 py-2 text-xs">
                                {n.is_voice && (
                                  <span className="text-sky-400 mr-1">[Ses]</span>
                                )}
                                {n.content}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-600">Bu iş için not kaydı yok.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
