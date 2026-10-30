import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/features/orders/order-constants";
import { formatDateShort } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";
import type { Job, JobNote, JobStatus, PaymentStatus } from "@/types/database";

export type OrderTimelineEvent = {
  id: string;
  at: string;
  title: string;
  meta?: string;
  detail?: string;
  tone?: "neutral" | "success" | "danger";
};

export type OrderTimelineInput = Pick<
  Job,
  | "created_at"
  | "updated_at"
  | "status"
  | "payment_status"
  | "amount_paid"
  | "revenue_amount"
  | "payment_due_date"
  | "installment_count"
  | "installment_amount"
> & {
  job_notes?: JobNote[];
};

const MS_TOLERANCE = 1000;

function statusTone(status: JobStatus): OrderTimelineEvent["tone"] {
  if (status === "cancelled") return "danger";
  if (status === "completed") return "success";
  return "neutral";
}

function paymentTone(status: PaymentStatus): OrderTimelineEvent["tone"] {
  if (status === "paid") return "success";
  if (status === "unpaid") return "danger";
  return "neutral";
}

/** P3-06 öncesi job alanlarından türetilmiş olaylar (audit_events yokken). */
export function buildOrderTimelineEvents(
  job: OrderTimelineInput
): OrderTimelineEvent[] {
  const events: OrderTimelineEvent[] = [];

  events.push({
    id: "created",
    at: job.created_at,
    title: "Sipariş oluşturuldu",
    meta: ORDER_STATUS_LABELS.pending,
  });

  const notes = [...(job.job_notes ?? [])].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  for (const note of notes) {
    events.push({
      id: `note-${note.id}`,
      at: note.created_at,
      title: note.is_voice ? "Sesli not eklendi" : "Not eklendi",
      detail: note.content,
    });
  }

  const paid = job.amount_paid ?? 0;
  if (paid > 0) {
    events.push({
      id: "payment-recorded",
      at: job.updated_at,
      title: `${formatCurrency(paid)} ödeme kaydı`,
      meta: PAYMENT_STATUS_LABELS[job.payment_status],
      tone: paymentTone(job.payment_status),
    });
  }

  const revenue = job.revenue_amount ?? 0;
  const remaining = Math.max(0, revenue - paid);
  if (revenue > 0 && remaining > 0 && job.payment_status !== "paid") {
    events.push({
      id: "payment-remaining",
      at: job.updated_at,
      title: `${formatCurrency(remaining)} tahsilat bekleniyor`,
      meta: PAYMENT_STATUS_LABELS[job.payment_status],
      tone: "neutral",
    });
  }

  if (job.payment_due_date) {
    events.push({
      id: "payment-due",
      at: `${job.payment_due_date.slice(0, 10)}T09:00:00.000Z`,
      title: "Ödeme vadesi",
      meta: formatDateShort(job.payment_due_date),
      tone: job.payment_status === "paid" ? "success" : "neutral",
    });
  }

  if (job.installment_count && job.installment_count > 1) {
    const installmentMeta =
      job.installment_amount != null
        ? `${job.installment_count} × ${formatCurrency(job.installment_amount)}`
        : `${job.installment_count} taksit`;
    events.push({
      id: "installments",
      at: job.updated_at,
      title: "Taksit planı",
      meta: installmentMeta,
    });
  }

  const createdMs = new Date(job.created_at).getTime();
  const updatedMs = new Date(job.updated_at).getTime();
  if (updatedMs - createdMs > MS_TOLERANCE) {
    events.push({
      id: "status-snapshot",
      at: job.updated_at,
      title: `Durum: ${ORDER_STATUS_LABELS[job.status]}`,
      tone: statusTone(job.status),
    });
  }

  return events.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}
