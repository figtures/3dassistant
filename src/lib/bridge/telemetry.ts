import type { ConnectionStatus, NormalizedTelemetry, PrinterState } from "@/lib/printer-cloud/types";

const CONNECTION: ConnectionStatus[] = ["connected", "disconnected", "error", "never"];
const STATES: PrinterState[] = ["printing", "paused", "idle", "error", "offline", "unknown"];

export function parseBridgeTelemetry(body: unknown): NormalizedTelemetry | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const connectionStatus = o.connectionStatus;
  const printerState = o.printerState;
  if (
    typeof connectionStatus !== "string" ||
    !CONNECTION.includes(connectionStatus as ConnectionStatus)
  ) {
    return null;
  }
  if (typeof printerState !== "string" || !STATES.includes(printerState as PrinterState)) {
    return null;
  }
  const progress = o.progressPercent;
  const printTime = o.printTimeSeconds;
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : v === null ? null : undefined;
  const str = (v: unknown) =>
    typeof v === "string" ? v : v === null ? null : undefined;
  return {
    connectionStatus: connectionStatus as ConnectionStatus,
    printerState: printerState as PrinterState,
    jobName: typeof o.jobName === "string" ? o.jobName : o.jobName === null ? null : null,
    progressPercent:
      typeof progress === "number" && Number.isFinite(progress) ? progress : progress === null ? null : null,
    printTimeSeconds:
      typeof printTime === "number" && Number.isFinite(printTime) ? Math.floor(printTime) : printTime === null ? null : null,
    errorMessage:
      typeof o.errorMessage === "string" ? o.errorMessage : o.errorMessage === null ? null : null,
    bedTempC: num(o.bedTempC) ?? null,
    nozzleTempC: num(o.nozzleTempC) ?? null,
    chamberTempC: num(o.chamberTempC) ?? null,
    cameraStreamUrl: str(o.cameraStreamUrl) ?? null,
    raw: typeof o.raw === "object" && o.raw !== null ? (o.raw as Record<string, unknown>) : {},
  };
}
