import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobStatus } from "@/types/database";
import { toast } from "sonner";

export const BULK_UNDO_MS = 10_000;
const IN_CHUNK = 200;

export type BulkMutationResult = {
  requested: number;
  updated: number;
  skipped: number;
  error: string | null;
};

export function formatBulkSummary(
  updated: number,
  skipped: number,
  noun: string
): string {
  if (updated === 0 && skipped === 0) {
    return `Hiçbir ${noun} güncellenemedi`;
  }
  if (skipped > 0) {
    return `${updated} ${noun} güncellendi, ${skipped} atlandı (yetki)`;
  }
  if (updated === 1) {
    return `1 ${noun} güncellendi`;
  }
  return `${updated} ${noun} güncellendi`;
}

export function formatBulkDeleteSummary(
  deleted: number,
  skipped: number,
  noun: string
): string {
  if (skipped > 0) {
    return `${deleted} ${noun} silindi, ${skipped} atlandı (yetki)`;
  }
  return `${deleted} ${noun} silindi`;
}

async function resolveAccessibleJobIds(
  supabase: SupabaseClient,
  workspaceId: string,
  ids: string[]
): Promise<string[]> {
  const accessible: string[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from("jobs")
      .select("id")
      .eq("user_id", workspaceId)
      .in("id", chunk);
    if (error) throw error;
    accessible.push(...(data ?? []).map((row) => row.id as string));
  }
  return accessible;
}

export async function bulkPatchJobs(
  supabase: SupabaseClient,
  workspaceId: string,
  ids: string[],
  patch: Record<string, unknown>
): Promise<BulkMutationResult> {
  const requested = ids.length;
  if (!requested) {
    return { requested: 0, updated: 0, skipped: 0, error: null };
  }

  try {
    const accessible = await resolveAccessibleJobIds(supabase, workspaceId, ids);
    const skipped = requested - accessible.length;
    if (!accessible.length) {
      return { requested, updated: 0, skipped, error: null };
    }

    let updated = 0;
    for (let i = 0; i < accessible.length; i += IN_CHUNK) {
      const chunk = accessible.slice(i, i + IN_CHUNK);
      const { error } = await supabase.from("jobs").update(patch).in("id", chunk);
      if (error) {
        return { requested, updated, skipped, error: error.message };
      }
      updated += chunk.length;
    }

    return { requested, updated, skipped, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Toplu güncelleme başarısız";
    return { requested, updated: 0, skipped: 0, error: message };
  }
}

export async function bulkDeleteJobs(
  supabase: SupabaseClient,
  workspaceId: string,
  ids: string[]
): Promise<BulkMutationResult> {
  const requested = ids.length;
  if (!requested) {
    return { requested: 0, updated: 0, skipped: 0, error: null };
  }

  try {
    const accessible = await resolveAccessibleJobIds(supabase, workspaceId, ids);
    const skipped = requested - accessible.length;
    if (!accessible.length) {
      return { requested, updated: 0, skipped, error: null };
    }

    let updated = 0;
    for (let i = 0; i < accessible.length; i += IN_CHUNK) {
      const chunk = accessible.slice(i, i + IN_CHUNK);
      const { error } = await supabase.from("jobs").delete().in("id", chunk);
      if (error) {
        return { requested, updated, skipped, error: error.message };
      }
      updated += chunk.length;
    }

    return { requested, updated, skipped, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Toplu silme başarısız";
    return { requested, updated: 0, skipped: 0, error: message };
  }
}

export type StatusUndoSnapshot = Map<string, JobStatus>;

export async function fetchJobStatusesForUndo(
  supabase: SupabaseClient,
  workspaceId: string,
  ids: string[]
): Promise<StatusUndoSnapshot> {
  const snapshot: StatusUndoSnapshot = new Map();
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from("jobs")
      .select("id, status")
      .eq("user_id", workspaceId)
      .in("id", chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      snapshot.set(row.id as string, row.status as JobStatus);
    }
  }
  return snapshot;
}

export async function bulkUpdateJobStatus(
  supabase: SupabaseClient,
  workspaceId: string,
  ids: string[],
  status: JobStatus
): Promise<{ result: BulkMutationResult; undo: StatusUndoSnapshot }> {
  const undo = await fetchJobStatusesForUndo(supabase, workspaceId, ids);
  const result = await bulkPatchJobs(supabase, workspaceId, ids, { status });
  return { result, undo };
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function bulkShiftJobDeliveryDates(
  supabase: SupabaseClient,
  workspaceId: string,
  ids: string[],
  daysDelta: number
): Promise<BulkMutationResult> {
  const requested = ids.length;
  if (!requested || daysDelta === 0) {
    return { requested, updated: 0, skipped: requested, error: null };
  }

  try {
    const accessible = await resolveAccessibleJobIds(supabase, workspaceId, ids);
    const skipped = requested - accessible.length;
    if (!accessible.length) {
      return { requested, updated: 0, skipped, error: null };
    }

    const { data, error: fetchError } = await supabase
      .from("jobs")
      .select("id, delivery_date, job_date")
      .eq("user_id", workspaceId)
      .in("id", accessible);
    if (fetchError) {
      return { requested, updated: 0, skipped: 0, error: fetchError.message };
    }

    let updated = 0;
    for (const row of data ?? []) {
      const base =
        (row.delivery_date as string | null) ??
        (row.job_date as string | null) ??
        new Date().toISOString().slice(0, 10);
      const next = addDaysIso(base, daysDelta);
      const { error } = await supabase
        .from("jobs")
        .update({ delivery_date: next })
        .eq("id", row.id as string);
      if (error) {
        return { requested, updated, skipped, error: error.message };
      }
      updated += 1;
    }

    return { requested, updated, skipped, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Teslim tarihleri güncellenemedi";
    return { requested, updated: 0, skipped: 0, error: message };
  }
}

export async function bulkMarkJobsPaid(
  supabase: SupabaseClient,
  workspaceId: string,
  ids: string[]
): Promise<BulkMutationResult> {
  const requested = ids.length;
  if (!requested) {
    return { requested: 0, updated: 0, skipped: 0, error: null };
  }

  try {
    const accessible = await resolveAccessibleJobIds(supabase, workspaceId, ids);
    const skipped = requested - accessible.length;
    if (!accessible.length) {
      return { requested, updated: 0, skipped, error: null };
    }

    const { data, error: fetchError } = await supabase
      .from("jobs")
      .select("id, revenue_amount, amount_paid")
      .eq("user_id", workspaceId)
      .in("id", accessible);
    if (fetchError) {
      return { requested, updated: 0, skipped: 0, error: fetchError.message };
    }

    let updated = 0;
    for (const row of data ?? []) {
      const revenue = (row.revenue_amount as number | null) ?? 0;
      const { error } = await supabase
        .from("jobs")
        .update({
          payment_status: "paid",
          amount_paid: revenue,
          amount_remaining: 0,
        })
        .eq("id", row.id as string);
      if (error) {
        return { requested, updated, skipped, error: error.message };
      }
      updated += 1;
    }

    return { requested, updated, skipped, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ödeme durumu güncellenemedi";
    return { requested, updated: 0, skipped: 0, error: message };
  }
}

export async function restoreJobStatuses(
  supabase: SupabaseClient,
  workspaceId: string,
  snapshot: StatusUndoSnapshot
): Promise<BulkMutationResult> {
  const ids = [...snapshot.keys()];
  const requested = ids.length;
  if (!requested) {
    return { requested: 0, updated: 0, skipped: 0, error: null };
  }

  let updated = 0;
  let skipped = 0;

  for (const [id, status] of snapshot) {
    const { data, error } = await supabase
      .from("jobs")
      .update({ status })
      .eq("id", id)
      .eq("user_id", workspaceId)
      .select("id");
    if (error) {
      return { requested, updated, skipped, error: error.message };
    }
    if ((data ?? []).length) updated += 1;
    else skipped += 1;
  }

  return { requested, updated, skipped, error: null };
}

export function showBulkMutationToast(
  message: string,
  options?: {
    undo?: () => void | Promise<void>;
  }
): void {
  if (options?.undo) {
    toast.success(message, {
      duration: BULK_UNDO_MS,
      action: {
        label: "Geri al",
        onClick: () => {
          void options.undo?.();
        },
      },
    });
    return;
  }
  toast.success(message);
}
