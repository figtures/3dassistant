import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";
import { parseTurkishNote } from "@/lib/parse-note";
import { getMaterialColors } from "@/lib/materials";
import type { Customer, Job, JobStatus, Material, MaterialColor } from "@/types/database";
import {
  toSchemaPayload,
  validateOrderForm,
  type OrderFormInput,
} from "@/features/orders/order-schema";
import { toast } from "sonner";

export type PendingNote = { content: string; is_voice: boolean };

export async function deleteOrder(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("jobs").delete().eq("id", orderId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function updateOrderStatus(
  supabase: SupabaseClient,
  orderId: string,
  status: JobStatus
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("jobs")
    .update({ status })
    .eq("id", orderId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function updateOrderSchedule(
  supabase: SupabaseClient,
  orderId: string,
  patch: { machine_id: string; job_date: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("jobs")
    .update({
      machine_id: patch.machine_id,
      job_date: patch.job_date,
    })
    .eq("id", orderId);
  if (error) return { error: error.message };
  return { error: null };
}

function stockWarning(
  form: OrderFormInput,
  materials: Material[],
  existingJob: Job | null
): void {
  const parsed = validateOrderForm(form);
  if (!parsed.success) return;
  const data = parsed.data;
  if (data.status !== "completed" || !data.material_color_id || data.grams_used <= 0) {
    return;
  }
  const mat = materials.find((m) => m.id === data.material_id);
  const colors = mat ? getMaterialColors(mat) : [];
  const colorRow = colors.find((c) => c.id === data.material_color_id);
  if (!colorRow) return;

  const wasCompleted =
    existingJob?.status === "completed" && existingJob?.stock_deducted;
  const prevGrams = wasCompleted ? (existingJob?.grams_used ?? 0) : 0;
  const delta = wasCompleted ? data.grams_used - prevGrams : data.grams_used;
  if (delta > colorRow.stock_grams) {
    toast.warning(
      `Stok yetersiz: ${colorRow.color_name} için ${colorRow.stock_grams}g var, ${delta}g düşülecek. Stok sıfıra indirilecek.`
    );
  }
}

export async function saveOrder(
  supabase: SupabaseClient,
  queryClient: QueryClient,
  userId: string,
  form: OrderFormInput,
  materials: Material[],
  customers: Customer[],
  existingJob: Job | null,
  pendingNotes: PendingNote[],
  existingJobId: string | null
): Promise<{ error: string | null; jobId: string | null }> {
  const validated = validateOrderForm(form);
  if (!validated.success) {
    const first = validated.error.issues[0];
    return { error: first?.message ?? "Form geçersiz", jobId: null };
  }

  stockWarning(form, materials, existingJob);

  let resolvedCustomerId = form.customer_id || null;

  if (!resolvedCustomerId && form.pending_customer_name.trim()) {
    const { data: newCustomer, error: custErr } = await supabase
      .from("customers")
      .insert({
        user_id: userId,
        name: form.pending_customer_name.trim(),
        source: form.pending_customer_source || null,
        referral: form.pending_customer_referral || null,
        referred_by_customer_id: form.pending_referred_by_customer_id || null,
      })
      .select("id")
      .single();
    if (custErr) {
      return { error: `Müşteri oluşturulamadı: ${custErr.message}`, jobId: null };
    }
    resolvedCustomerId = newCustomer.id;
    queryClient.invalidateQueries({ queryKey: ["customers"] });
  }

  const data = validated.data;
  const payload = {
    user_id: userId,
    machine_id: data.machine_id,
    job_date: data.job_date,
    title: data.title,
    description: data.description ?? null,
    customer_id: resolvedCustomerId,
    material_id: data.material_id ?? null,
    material_color_id: data.material_color_id ?? null,
    grams_used: data.grams_used || null,
    revenue_amount: data.revenue_amount,
    duration_minutes: data.duration_minutes,
    payment_status: data.payment_status,
    amount_paid: data.amount_paid,
    amount_remaining: data.amount_remaining ?? 0,
    payment_due_date: data.payment_due_date ?? null,
    installment_count: data.installment_count,
    installment_amount: data.installment_amount,
    delivery_date: data.delivery_date ?? data.job_date,
    status: data.status,
    cell_color: data.cell_color,
  };

  let jobId = existingJob?.id ?? existingJobId;

  if (jobId) {
    const { error } = await supabase.from("jobs").update(payload).eq("id", jobId);
    if (error) return { error: error.message, jobId: null };
  } else {
    const { data: inserted, error } = await supabase
      .from("jobs")
      .insert(payload)
      .select()
      .single();
    if (error) return { error: error.message, jobId: null };
    jobId = inserted.id;
  }

  for (const note of pendingNotes) {
    await supabase.from("job_notes").insert({
      job_id: jobId,
      content: note.content,
      is_voice: note.is_voice,
      parsed_data: parseTurkishNote(note.content, materials, customers),
    });
  }

  queryClient.invalidateQueries({ queryKey: ["jobs"] });
  queryClient.invalidateQueries({ queryKey: ["orders"] });
  queryClient.invalidateQueries({ queryKey: ["order", jobId] });
  queryClient.invalidateQueries({ queryKey: ["materials"] });

  return { error: null, jobId };
}

export async function uploadOrderFile(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  file: File
): Promise<{ error: string | null }> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const fileType = ext === "stl"
    ? "stl"
    : ["jpg", "jpeg", "png", "webp", "gif"].includes(ext ?? "")
      ? "image"
      : "other";
  const path = `${userId}/${jobId}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("job-files")
    .upload(path, file);
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("job_files").insert({
    job_id: jobId,
    file_name: file.name,
    file_path: path,
    file_type: fileType,
    file_size: file.size,
  });
  if (error) return { error: error.message };
  return { error: null };
}

export function findMaterialColor(
  materials: Material[],
  materialId: string,
  colorId: string
): MaterialColor | undefined {
  const mat = materials.find((m) => m.id === materialId);
  if (!mat) return undefined;
  return getMaterialColors(mat).find((c) => c.id === colorId);
}
