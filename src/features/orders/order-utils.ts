import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Job, JobStatus, PaymentStatus } from "@/types/database";
import { todayIsoInIstanbul } from "@/lib/format";
import type { OrderTabId } from "@/features/orders/order-constants";

export function isOrderOverdue(job: Pick<Job, "delivery_date" | "status">): boolean {
  if (!job.delivery_date) return false;
  if (job.status === "completed" || job.status === "cancelled") return false;
  const today = todayIsoInIstanbul();
  return job.delivery_date.slice(0, 10) < today;
}

export function overdueDays(job: Pick<Job, "delivery_date">): number {
  if (!job.delivery_date) return 0;
  const today = parseISO(todayIsoInIstanbul());
  const due = parseISO(job.delivery_date.slice(0, 10));
  return Math.max(0, differenceInCalendarDays(today, due));
}

export function isPaymentPending(job: Pick<Job, "payment_status">): boolean {
  const s = job.payment_status;
  return s === "unpaid" || s === "partial" || s === "upcoming";
}

export function parseOrderTab(value: string | null): OrderTabId {
  if (
    value === "pending" ||
    value === "in_progress" ||
    value === "overdue" ||
    value === "payment"
  ) {
    return value;
  }
  return "all";
}

export function tabToStatusFilter(tab: OrderTabId): JobStatus[] | undefined {
  if (tab === "pending") return ["pending"];
  if (tab === "in_progress") return ["in_progress"];
  return undefined;
}

export function tabToPaymentFilter(tab: OrderTabId): PaymentStatus[] | undefined {
  if (tab === "payment") return ["unpaid", "partial", "upcoming"];
  return undefined;
}

export function parseMultiParam(
  value: string | null,
  allowed: readonly string[]
): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => allowed.includes(s));
}
