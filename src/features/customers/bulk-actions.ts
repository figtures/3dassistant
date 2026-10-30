import type { SupabaseClient } from "@supabase/supabase-js";

const IN_CHUNK = 200;

export type BulkMutationResult = {
  requested: number;
  updated: number;
  skipped: number;
  error: string | null;
};

async function resolveAccessibleCustomerIds(
  supabase: SupabaseClient,
  workspaceId: string,
  ids: string[]
): Promise<string[]> {
  const accessible: string[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", workspaceId)
      .in("id", chunk);
    if (error) throw error;
    accessible.push(...(data ?? []).map((row) => row.id as string));
  }
  return accessible;
}

export async function bulkDeleteCustomers(
  supabase: SupabaseClient,
  workspaceId: string,
  ids: string[]
): Promise<BulkMutationResult> {
  const requested = ids.length;
  if (!requested) {
    return { requested: 0, updated: 0, skipped: 0, error: null };
  }

  try {
    const accessible = await resolveAccessibleCustomerIds(supabase, workspaceId, ids);
    const skipped = requested - accessible.length;
    if (!accessible.length) {
      return { requested, updated: 0, skipped, error: null };
    }

    let updated = 0;
    for (let i = 0; i < accessible.length; i += IN_CHUNK) {
      const chunk = accessible.slice(i, i + IN_CHUNK);
      const { error } = await supabase.from("customers").delete().in("id", chunk);
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
