import type { SupabaseClient } from "@supabase/supabase-js";
import { probeBridgeServiceHealth } from "@/lib/bridge/probe-health";
import { recordStatusCheck } from "@/lib/status/checks";

/** Zamanlanmış görevlerden servis durumu satırı yazar (hata yutulur). */
export async function recordCronAppOk(
  supabase: SupabaseClient,
  latencyMs?: number
): Promise<void> {
  await recordStatusCheck(supabase, {
    service: "app",
    ok: true,
    latencyMs: latencyMs ?? null,
  });
}

export async function recordCloudSyncStatus(
  supabase: SupabaseClient,
  ok: boolean,
  latencyMs: number
): Promise<void> {
  await recordStatusCheck(supabase, {
    service: "cloud_sync",
    ok,
    latencyMs,
  });
}

export async function recordEmailCronStatus(
  supabase: SupabaseClient,
  ok: boolean,
  latencyMs: number
): Promise<void> {
  await recordStatusCheck(supabase, {
    service: "email",
    ok,
    latencyMs,
  });
}

export async function recordBridgeProbeStatus(supabase: SupabaseClient): Promise<void> {
  const probe = await probeBridgeServiceHealth();
  const ok =
    probe.status === "ok" || probe.status === "skipped";
  await recordStatusCheck(supabase, {
    service: "bridge",
    ok,
    latencyMs: probe.latencyMs ?? null,
  });
}
