import { addDays, format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import type { Job } from "@/types/database";
import { todayIsoInIstanbul } from "@/lib/format";
import { isPaymentPending } from "@/features/orders/order-utils";

export function tomorrowIsoInIstanbul(from = new Date()): string {
  const today = parseISO(todayIsoInIstanbul());
  return addDays(today, 1).toISOString().slice(0, 10);
}

export function isJobDeliveryTomorrow(job: Pick<Job, "delivery_date" | "status">): boolean {
  if (!job.delivery_date) return false;
  if (job.status === "completed" || job.status === "cancelled") return false;
  return job.delivery_date.slice(0, 10) === tomorrowIsoInIstanbul();
}

export function formatDeliveryTomorrowNotification(job: Pick<Job, "title" | "id">): {
  title: string;
  body: string;
  href: string;
} {
  const title = job.title ?? "İsimsiz iş";
  const delivery = tomorrowIsoInIstanbul();
  const deliveryLabel = format(parseISO(delivery), "d MMMM yyyy", { locale: tr });
  return {
    title: `Yarın teslim: ${title}`,
    body: `Teslim tarihi ${deliveryLabel}.`,
    href: `/orders/${job.id}`,
  };
}

export function isJobPaymentDueOverdue(
  job: Pick<Job, "payment_due_date" | "payment_status" | "status">
): boolean {
  if (!job.payment_due_date) return false;
  if (job.status === "cancelled") return false;
  if (!isPaymentPending(job)) return false;
  const today = todayIsoInIstanbul();
  return job.payment_due_date.slice(0, 10) < today;
}

export function formatPaymentDueNotification(job: Pick<Job, "title" | "id" | "payment_due_date">): {
  title: string;
  body: string;
  href: string;
} {
  const title = job.title ?? "İsimsiz iş";
  const due = job.payment_due_date
    ? format(parseISO(job.payment_due_date.slice(0, 10)), "d MMMM yyyy", { locale: tr })
    : "—";
  return {
    title: `Ödeme vadesi geçti: ${title}`,
    body: `Vade tarihi ${due}.`,
    href: `/orders/${job.id}`,
  };
}

export function formatPaymentDueEmail(job: Pick<Job, "title" | "payment_due_date">): {
  subject: string;
  html: string;
  text: string;
} {
  const title = job.title ?? "İsimsiz iş";
  const due = job.payment_due_date
    ? format(parseISO(job.payment_due_date.slice(0, 10)), "d MMMM yyyy", { locale: tr })
    : "—";
  const subject = `Ödeme vadesi: ${title}`;
  const text = [
    "Ödeme vadesi geçmiş bir siparişiniz var.",
    "",
    `Sipariş: ${title}`,
    `Vade: ${due}`,
    "",
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/orders`,
  ].join("\n");
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 520px;">
      <h2 style="color: #ca8a04;">Ödeme vadesi</h2>
      <p><strong>${title}</strong> için vade tarihi geçmiş: ${due}</p>
      <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/orders">Siparişlere git</a>
    </div>
  `;
  return { subject, html, text };
}
