import type { SupabaseClient } from "@supabase/supabase-js";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

export async function supportReportRateLimited(
  admin: SupabaseClient,
  userId: string
): Promise<{ limited: boolean; count: number }> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from("support_reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) {
    console.warn("[support] rate limit check failed:", error.message);
    return { limited: false, count: 0 };
  }

  const n = count ?? 0;
  return { limited: n >= MAX_PER_WINDOW, count: n };
}
