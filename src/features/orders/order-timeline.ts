import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/features/orders/order-constants";
import { readDiffField, readDiffFieldChange } from "@/lib/audit/diff";
import { describeAuditEvent, formatActorName, type AuditDescribeContext } from "@/lib/audit/describe";
import { formatDateShort } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";
import type { AuditEvent, Job, JobNote, JobStatus, PaymentStatus } from "@/types/database";

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
  | "id"
  | "created_at"
  | "updated_at"
  | "status"
  | "payment_status"
  | "amount_paid"
  | "revenue_amount"
  | "payment_due_date"
  | "installment_count"
  | "installment_amount"
  | "title"
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

function noteEvents(job: OrderTimelineInput): OrderTimelineEvent[] {
  const notes = [...(job.job_notes ?? [])].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return notes.map((note) => ({
    id: `note-${note.id}`,
    at: note.created_at,
    title: note.is_voice ? "Sesli not eklendi" : "Not eklendi",
    detail: note.content,
  }));
}

function auditEventToTimeline(
  event: AuditEvent,
  ctx: AuditDescribeContext
): OrderTimelineEvent | null {
  if (event.entity !== "jobs") return null;

  let tone: OrderTimelineEvent["tone"] = "neutral";
  let meta: string | undefined;

  if (event.action === "insert") {
    const status = readDiffField(event.diff, "status");
    if (typeof status === "string") {
      meta = ORDER_STATUS_LABELS[status as JobStatus] ?? status;
    }
  }

  if (event.action === "update") {
    const statusChange = readDiffFieldChange(event.diff, "status");
    if (statusChange && typeof statusChange.new === "string") {
      tone = statusTone(statusChange.new as JobStatus);
      meta = ORDER_STATUS_LABELS[statusChange.new as JobStatus] ?? statusChange.new;
    }
    const payChange = readDiffFieldChange(event.diff, "payment_status");
    if (payChange && typeof payChange.new === "string") {
      tone = paymentTone(payChange.new as PaymentStatus);
      meta = PAYMENT_STATUS_LABELS[payChange.new as PaymentStatus] ?? payChange.new;
    }
    const paidChange = readDiffFieldChange(event.diff, "amount_paid");
    if (paidChange && typeof paidChange.new === "number" && paidChange.new > 0) {
      meta = PAYMENT_STATUS_LABELS[jobPaymentFromDiff(event.diff)] ?? meta;
    }
  }

  if (event.action === "delete") {
    tone = "danger";
  }

  return {
    id: `audit-${event.id}`,
    at: event.created_at,
    title: describeAuditEvent(event, ctx),
    meta,
    tone,
  };
}

function jobPaymentFromDiff(
  diff: Record<string, unknown> | null | undefined
): PaymentStatus {
  const raw = readDiffField(diff, "payment_status");
  if (typeof raw === "string") return raw as PaymentStatus;
  return "partial";
}

/** audit_events varsa sipariş geçmişi oradan; notlar her zaman job_notes'tan. */
export function buildOrderTimelineEvents(
  job: OrderTimelineInput,
  auditEvents: AuditEvent[] = [],
  describeCtx: AuditDescribeContext = {}
): OrderTimelineEvent[] {
  const jobAudits = auditEvents.filter(
    (e) => e.entity === "jobs" && e.entity_id === job.id
  );

  const entityLabels = {
    ...describeCtx.entityLabels,
    [job.id]: job.title?.trim() || describeCtx.entityLabels?.[job.id] || "Sipariş",
  };
  const ctx: AuditDescribeContext = {
    ...describeCtx,
    entityLabels,
  };

  if (jobAudits.length > 0) {
    const fromAudit = jobAudits
      .map((e) =>
        auditEventToTimeline(e, {
          ...ctx,
          actorName: formatActorName(e.actor),
        })
      )
      .filter((e): e is OrderTimelineEvent => e !== null);
    return [...fromAudit, ...noteEvents(job)].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );
  }

  return buildLegacyOrderTimelineEvents(job);
}

function buildLegacyOrderTimelineEvents(
  job: OrderTimelineInput
): OrderTimelineEvent[] {
  const events: OrderTimelineEvent[] = [];

  events.push({
    id: "created",
    at: job.created_at,
    title: "Sipariş oluşturuldu",
    meta: ORDER_STATUS_LABELS.pending,
  });

  events.push(...noteEvents(job));

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
