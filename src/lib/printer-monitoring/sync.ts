import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchOctoPrintTelemetry,
  OctoPrintUnreachableError,
  testOctoPrintConnection,
} from "./octoprint";
import type { AdapterType, NormalizedTelemetry } from "./types";
import { maybeRecordTelemetrySnapshot } from "./telemetry-history";

export type MachineConnectionRow = {
  id: string;
  machine_id: string;
  user_id: string;
  adapter_type: AdapterType;
  base_url: string | null;
  api_key: string | null;
  enabled: boolean;
};

export async function pullTelemetryForConnection(
  conn: MachineConnectionRow
): Promise<NormalizedTelemetry | { unreachable: true; error: string }> {
  if (conn.adapter_type === "manual") {
    return {
      connectionStatus: "never",
      printerState: "offline",
      jobName: null,
      progressPercent: null,
      printTimeSeconds: null,
      errorMessage: null,
      raw: { manual: true },
    };
  }

  if (conn.adapter_type === "moonraker") {
    return {
      connectionStatus: "disconnected",
      printerState: "unknown",
      jobName: null,
      progressPercent: null,
      printTimeSeconds: null,
      errorMessage: "Moonraker adaptörü henüz uygulanmadı",
      raw: { moonraker: "not_implemented" },
    };
  }

  if (!conn.base_url?.trim() || !conn.api_key?.trim()) {
    return {
      connectionStatus: "error",
      printerState: "unknown",
      jobName: null,
      progressPercent: null,
      printTimeSeconds: null,
      errorMessage: "OctoPrint URL veya API anahtarı eksik",
      raw: {},
    };
  }

  try {
    return await fetchOctoPrintTelemetry(conn.base_url, conn.api_key);
  } catch (e) {
    const msg =
      e instanceof OctoPrintUnreachableError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Erişilemedi";
    return { unreachable: true, error: msg };
  }
}

export async function applyTelemetryToMachine(
  supabase: SupabaseClient,
  machineId: string,
  telemetry: NormalizedTelemetry | { unreachable: true; error: string },
  userId?: string
) {
  const now = new Date().toISOString();

  if ("unreachable" in telemetry) {
    let query = supabase
      .from("machines")
      .update({
        connection_status: "disconnected",
        printer_state: "offline",
        error_message: telemetry.error,
        telemetry_updated_at: now,
      })
      .eq("id", machineId);
    if (userId) query = query.eq("user_id", userId);
    const { error } = await query;
    if (error) {
      return { ok: false as const, error: error.message };
    }
    return {
      ok: true as const,
      telemetry: {
        connectionStatus: "disconnected" as const,
        printerState: "offline" as const,
        jobName: null,
        progressPercent: null,
        printTimeSeconds: null,
        errorMessage: telemetry.error,
        raw: { unreachable: telemetry.error },
      },
      unreachable: true as const,
    };
  }

  let query = supabase
    .from("machines")
    .update({
      last_seen_at: now,
      connection_status: telemetry.connectionStatus,
      printer_state: telemetry.printerState,
      job_name: telemetry.jobName,
      progress_percent: telemetry.progressPercent,
      print_time_seconds: telemetry.printTimeSeconds,
      error_message: telemetry.errorMessage,
      bed_temp_c: telemetry.bedTempC ?? null,
      nozzle_temp_c: telemetry.nozzleTempC ?? null,
      chamber_temp_c: telemetry.chamberTempC ?? null,
      camera_stream_url: telemetry.cameraStreamUrl ?? null,
      telemetry_raw: telemetry.raw,
      telemetry_updated_at: now,
    })
    .eq("id", machineId);
  if (userId) query = query.eq("user_id", userId);
  const { error } = await query;

  if (error) {
    return { ok: false as const, error: error.message };
  }
  if (userId) {
    await maybeRecordTelemetrySnapshot(supabase, machineId, userId, telemetry).catch(() => {});
  }
  return { ok: true as const, telemetry };
}

export async function syncMachineById(
  supabase: SupabaseClient,
  machineId: string,
  userId?: string
) {
  let connQuery = supabase
    .from("machine_connections")
    .select("*")
    .eq("machine_id", machineId)
    .eq("enabled", true);

  if (userId) {
    connQuery = connQuery.eq("user_id", userId);
  }

  const { data: conn, error: connError } = await connQuery.maybeSingle();
  if (connError) {
    return { ok: false as const, error: connError.message };
  }
  if (!conn) {
    return { ok: false as const, error: "Bu makine için bağlantı tanımlı değil" };
  }

  const pulled = await pullTelemetryForConnection(conn as MachineConnectionRow);
  const applied = await applyTelemetryToMachine(supabase, machineId, pulled, userId);
  return applied;
}

export async function testConnection(
  adapterType: AdapterType,
  baseUrl: string | null,
  apiKey: string | null
) {
  if (adapterType === "manual") {
    return { ok: true as const, message: "Manuel mod — otomatik izleme yok" };
  }
  if (adapterType === "moonraker") {
    return { ok: false as const, error: "Moonraker testi henüz desteklenmiyor" };
  }
  if (!baseUrl?.trim() || !apiKey?.trim()) {
    return { ok: false as const, error: "URL ve API anahtarı gerekli" };
  }
  return testOctoPrintConnection(baseUrl, apiKey);
}
