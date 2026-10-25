import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedTelemetry } from "@/lib/printer-cloud/types";

const MIN_INTERVAL_MS = 45_000;

export type TelemetrySnapshotRow = {
  id: string;
  machine_id: string;
  recorded_at: string;
  printer_state: string;
  connection_status: string;
  progress_percent: number | null;
  job_name: string | null;
  print_time_seconds: number | null;
};

/** Önemli değişiklik veya baskı sırasında periyodik kayıt. */
export async function maybeRecordTelemetrySnapshot(
  supabase: SupabaseClient,
  machineId: string,
  userId: string,
  telemetry: NormalizedTelemetry
): Promise<void> {
  const { data: last } = await supabase
    .from("machine_telemetry_snapshots")
    .select("recorded_at, printer_state, progress_percent")
    .eq("machine_id", machineId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = Date.now();
  const active = telemetry.printerState === "printing" || telemetry.printerState === "paused";
  let shouldWrite = !last;

  if (last) {
    const elapsed = now - new Date(last.recorded_at).getTime();
    const stateChanged = last.printer_state !== telemetry.printerState;
    const progressMoved =
      telemetry.progressPercent != null &&
      last.progress_percent != null &&
      Math.abs(Number(last.progress_percent) - telemetry.progressPercent) >= 1;
    if (stateChanged || progressMoved) shouldWrite = true;
    else if (active && elapsed >= MIN_INTERVAL_MS) shouldWrite = true;
    else if (!active && elapsed >= 5 * MIN_INTERVAL_MS) shouldWrite = true;
  }

  if (!shouldWrite) return;

  await supabase.from("machine_telemetry_snapshots").insert({
    machine_id: machineId,
    user_id: userId,
    printer_state: telemetry.printerState,
    connection_status: telemetry.connectionStatus,
    progress_percent: telemetry.progressPercent,
    job_name: telemetry.jobName,
    print_time_seconds: telemetry.printTimeSeconds,
    bed_temp_c: telemetry.bedTempC ?? null,
    nozzle_temp_c: telemetry.nozzleTempC ?? null,
    chamber_temp_c: telemetry.chamberTempC ?? null,
  });
}

export async function fetchTelemetryHistory(
  supabase: SupabaseClient,
  machineId: string,
  userId: string,
  hours = 24
): Promise<TelemetrySnapshotRow[]> {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const { data, error } = await supabase
    .from("machine_telemetry_snapshots")
    .select(
      "id, machine_id, recorded_at, printer_state, connection_status, progress_percent, job_name, print_time_seconds"
    )
    .eq("machine_id", machineId)
    .eq("user_id", userId)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message);
  return (data ?? []) as TelemetrySnapshotRow[];
}
