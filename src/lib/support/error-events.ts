import type { SupabaseClient } from "@supabase/supabase-js";
import { errorFingerprint, truncateStack } from "./fingerprint";
import { sanitizeClientErrorMessage } from "./redact";

export type RecordErrorInput = {
  userId?: string | null;
  route?: string;
  message: string;
  stack?: string;
  source: "client" | "server";
  digest?: string;
};

export async function recordClientErrorEvent(
  db: SupabaseClient,
  input: RecordErrorInput
): Promise<{ fingerprint: string } | null> {
  const message = sanitizeClientErrorMessage(input.message);
  if (!message) return null;

  const fingerprint = errorFingerprint({
    message,
    route: input.route,
    source: input.source,
  });
  const stack = truncateStack(input.stack);
  const now = new Date().toISOString();

  if (input.userId) {
    const { data: existing } = await db
      .from("client_error_events")
      .select("id, count")
      .eq("user_id", input.userId)
      .eq("fingerprint", fingerprint)
      .eq("source", input.source)
      .maybeSingle();

    if (existing) {
      await db
        .from("client_error_events")
        .update({
          count: (existing.count ?? 1) + 1,
          last_seen: now,
          route: input.route ?? null,
          message,
          stack: stack ?? null,
          sample_digest: input.digest ?? null,
        })
        .eq("id", existing.id);
      return { fingerprint };
    }

    const { error } = await db.from("client_error_events").insert({
      user_id: input.userId,
      route: input.route ?? null,
      message,
      stack: stack ?? null,
      fingerprint,
      source: input.source,
      count: 1,
      first_seen: now,
      last_seen: now,
      sample_digest: input.digest ?? null,
    });
    if (error) {
      console.warn("[telemetry] insert failed:", error.message);
      return null;
    }
    return { fingerprint };
  }

  const { data: existing } = await db
    .from("client_error_events")
    .select("id, count")
    .is("user_id", null)
    .eq("fingerprint", fingerprint)
    .eq("source", input.source)
    .maybeSingle();

  if (existing) {
    await db
      .from("client_error_events")
      .update({
        count: (existing.count ?? 1) + 1,
        last_seen: now,
        route: input.route ?? null,
        message,
        stack: stack ?? null,
        sample_digest: input.digest ?? null,
      })
      .eq("id", existing.id);
    return { fingerprint };
  }

  const { error } = await db.from("client_error_events").insert({
    user_id: null,
    route: input.route ?? null,
    message,
    stack: stack ?? null,
    fingerprint,
    source: input.source,
    count: 1,
    first_seen: now,
    last_seen: now,
    sample_digest: input.digest ?? null,
  });
  if (error) {
    console.warn("[telemetry] anon insert failed:", error.message);
    return null;
  }
  return { fingerprint };
}
