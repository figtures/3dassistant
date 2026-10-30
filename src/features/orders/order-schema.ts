import { z } from "zod";
import type { JobStatus, PaymentStatus } from "@/types/database";

export const orderFormSchema = z
  .object({
    title: z.string().trim().min(1, "Başlık gerekli"),
    description: z.string().optional(),
    machine_id: z.string().min(1, "Makine gerekli"),
    customer_id: z.string().optional(),
    pending_customer_name: z.string().optional(),
    pending_customer_source: z.string().optional(),
    pending_customer_referral: z.string().optional(),
    pending_referred_by_customer_id: z.string().optional(),
    material_id: z.string().optional(),
    material_color_id: z.string().optional(),
    job_date: z.string().min(1, "Başlangıç tarihi gerekli"),
    delivery_date: z.string().optional(),
    grams_used: z.coerce.number().min(0, "Gram negatif olamaz"),
    duration_minutes: z.coerce.number().min(0).optional().nullable(),
    revenue_amount: z.coerce.number().min(0, "Tutar negatif olamaz"),
    payment_status: z.custom<PaymentStatus>(),
    amount_paid: z.coerce.number().min(0, "Ödenen tutar negatif olamaz"),
    amount_remaining: z.coerce.number().min(0).optional(),
    payment_due_date: z.string().optional(),
    installment_count: z.coerce.number().min(0).optional().nullable(),
    installment_amount: z.coerce.number().min(0).optional().nullable(),
    status: z.custom<JobStatus>(),
    cell_color: z.string().min(1),
  })
  .refine((data) => data.amount_paid <= data.revenue_amount, {
    message: "Ödenen tutar, sipariş tutarını aşamaz",
    path: ["amount_paid"],
  });

export type OrderFormValues = z.infer<typeof orderFormSchema>;

export type OrderFormInput = {
  title: string;
  description: string;
  machine_id: string;
  customer_id: string;
  pending_customer_name: string;
  pending_customer_source: string;
  pending_customer_referral: string;
  pending_referred_by_customer_id: string;
  material_id: string;
  material_color_id: string;
  job_date: string;
  delivery_date: string;
  grams_used: string;
  duration_hours: string;
  duration_minutes_part: string;
  revenue_amount: string;
  payment_status: PaymentStatus;
  amount_paid: string;
  amount_remaining: string;
  payment_due_date: string;
  installment_count: string;
  installment_amount: string;
  status: JobStatus;
  cell_color: string;
};

export function emptyOrderForm(
  defaults?: Partial<Pick<OrderFormInput, "machine_id" | "job_date">>
): OrderFormInput {
  const jobDate = defaults?.job_date ?? new Date().toISOString().slice(0, 10);
  return {
    title: "",
    description: "",
    machine_id: defaults?.machine_id ?? "",
    customer_id: "",
    pending_customer_name: "",
    pending_customer_source: "",
    pending_customer_referral: "",
    pending_referred_by_customer_id: "",
    material_id: "",
    material_color_id: "",
    job_date: jobDate,
    delivery_date: jobDate,
    grams_used: "",
    duration_hours: "",
    duration_minutes_part: "",
    revenue_amount: "",
    payment_status: "unpaid",
    amount_paid: "",
    amount_remaining: "",
    payment_due_date: "",
    installment_count: "",
    installment_amount: "",
    status: "pending",
    cell_color: "#3b82f6",
  };
}

export function orderFormFromJob(job: {
  title: string | null;
  description: string | null;
  machine_id: string;
  customer_id: string | null;
  material_id: string | null;
  material_color_id: string | null;
  job_date: string;
  delivery_date: string | null;
  grams_used: number | null;
  duration_minutes: number | null;
  revenue_amount: number | null;
  payment_status: PaymentStatus;
  amount_paid: number | null;
  amount_remaining: number | null;
  payment_due_date: string | null;
  installment_count: number | null;
  installment_amount: number | null;
  status: JobStatus;
  cell_color: string;
}): OrderFormInput {
  const totalMins = job.duration_minutes ?? 0;
  return {
    title: job.title ?? "",
    description: job.description ?? "",
    machine_id: job.machine_id,
    customer_id: job.customer_id ?? "",
    pending_customer_name: "",
    pending_customer_source: "",
    pending_customer_referral: "",
    pending_referred_by_customer_id: "",
    material_id: job.material_id ?? "",
    material_color_id: job.material_color_id ?? "",
    job_date: job.job_date,
    delivery_date: job.delivery_date ?? job.job_date,
    grams_used: job.grams_used != null ? String(job.grams_used) : "",
    duration_hours: totalMins ? String(Math.floor(totalMins / 60)) : "",
    duration_minutes_part: totalMins ? String(totalMins % 60) : "",
    revenue_amount: job.revenue_amount != null ? String(job.revenue_amount) : "",
    payment_status: job.payment_status ?? "unpaid",
    amount_paid: job.amount_paid != null ? String(job.amount_paid) : "",
    amount_remaining:
      job.amount_remaining != null ? String(job.amount_remaining) : "",
    payment_due_date: job.payment_due_date ?? "",
    installment_count:
      job.installment_count != null ? String(job.installment_count) : "",
    installment_amount:
      job.installment_amount != null ? String(job.installment_amount) : "",
    status: job.status,
    cell_color: job.cell_color,
  };
}

export function toSchemaPayload(form: OrderFormInput) {
  const hours = parseInt(form.duration_hours, 10) || 0;
  const mins = parseInt(form.duration_minutes_part, 10) || 0;
  const totalDurationMinutes = hours * 60 + mins || 0;

  return {
    title: form.title,
    description: form.description || undefined,
    machine_id: form.machine_id,
    customer_id: form.customer_id || undefined,
    pending_customer_name: form.pending_customer_name || undefined,
    pending_customer_source: form.pending_customer_source || undefined,
    pending_customer_referral: form.pending_customer_referral || undefined,
    pending_referred_by_customer_id:
      form.pending_referred_by_customer_id || undefined,
    material_id: form.material_id || undefined,
    material_color_id: form.material_color_id || undefined,
    job_date: form.job_date,
    delivery_date: form.delivery_date || form.job_date,
    grams_used: form.grams_used ? parseInt(form.grams_used, 10) : 0,
    duration_minutes: totalDurationMinutes || null,
    revenue_amount: form.revenue_amount ? parseFloat(form.revenue_amount) : 0,
    payment_status: form.payment_status,
    amount_paid: form.amount_paid ? parseFloat(form.amount_paid) : 0,
    amount_remaining: form.amount_remaining
      ? parseFloat(form.amount_remaining)
      : 0,
    payment_due_date: form.payment_due_date || undefined,
    installment_count: form.installment_count
      ? parseInt(form.installment_count, 10)
      : null,
    installment_amount: form.installment_amount
      ? parseFloat(form.installment_amount)
      : null,
    status: form.status,
    cell_color: form.cell_color,
  };
}

export function validateOrderForm(form: OrderFormInput) {
  return orderFormSchema.safeParse(toSchemaPayload(form));
}
