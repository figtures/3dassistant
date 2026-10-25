import type { CloudDevice, NormalizedTelemetry, PrinterState } from "./types";
import { CloudAuthError } from "./errors";

const PRUSA_CONNECT_BASE = "https://connect.prusa3d.com";
const REQUEST_TIMEOUT_MS = 20_000;

export type PrusaPrinterJson = {
  uuid?: string;
  name?: string;
  printer_model?: string;
  printer_type_name?: string;
  printer_state?: string;
  state?: string;
  connect_state?: string;
  state_reason?: string;
  job_info?: PrusaJobJson;
  job?: PrusaJobJson;
};

type PrusaJobJson = {
  display_name?: string;
  path?: string;
  progress?: number;
  state?: string;
  time_printing?: number | string;
};

function bearerToken(credentials: { apiKey: string | null; accessToken: string | null }): string {
  const token = credentials.accessToken?.trim() || credentials.apiKey?.trim();
  if (!token) {
    throw new CloudAuthError("Prusa Connect erişim anahtarı gerekli");
  }
  return token;
}

async function prusaFetch<T>(token: string, path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${PRUSA_CONNECT_BASE}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "PrintFlow/1.0",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      throw new CloudAuthError("Prusa Connect anahtarı geçersiz veya süresi dolmuş");
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        body ? `Prusa Connect hatası (${res.status})` : `Prusa Connect hatası (${res.status})`
      );
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function mapPrusaPrinterState(raw: string | undefined | null): PrinterState {
  const s = (raw ?? "").toUpperCase();
  if (s === "PRINTING" || s === "BUSY" || s === "MANIPULATING") return "printing";
  if (s === "PAUSED") return "paused";
  if (s === "ERROR" || s === "ATTENTION") return "error";
  if (s === "OFFLINE") return "offline";
  if (s === "IDLE" || s === "READY" || s === "FINISHED" || s === "STOPPED") return "idle";
  return "unknown";
}

function isPrusaOnline(p: PrusaPrinterJson): boolean {
  const state = (p.printer_state ?? p.state ?? "").toUpperCase();
  if (state === "OFFLINE") return false;
  const connect = (p.connect_state ?? "").toLowerCase();
  if (connect === "offline" || connect === "disconnected") return false;
  return true;
}

export async function prusaListDevices(credentials: {
  apiKey: string | null;
  accessToken: string | null;
}): Promise<CloudDevice[]> {
  const token = bearerToken(credentials);
  const data = await prusaFetch<{ printers?: PrusaPrinterJson[] } | PrusaPrinterJson[]>(
    token,
    "/app/printers?limit=100"
  );

  const list = Array.isArray(data) ? data : data.printers ?? [];
  return list
    .filter((p) => p.uuid)
    .map((p) => ({
      id: p.uuid!,
      name: p.name?.trim() || `Prusa ${p.uuid!.slice(0, 8)}`,
      model: p.printer_model ?? p.printer_type_name ?? null,
      online: isPrusaOnline(p),
    }));
}

export function normalizePrusaTelemetry(
  printer: PrusaPrinterJson,
  deviceId: string
): NormalizedTelemetry {
  const stateRaw = printer.printer_state ?? printer.state;
  const printerState = mapPrusaPrinterState(stateRaw);
  const job = printer.job_info ?? printer.job;
  const progress =
    typeof job?.progress === "number"
      ? Math.min(100, Math.max(0, job.progress))
      : null;
  const online = isPrusaOnline(printer);
  const effectiveState: PrinterState = online ? printerState : "offline";
  const activeJob = effectiveState === "printing" || effectiveState === "paused";
  const jobName =
    job?.display_name?.trim() ||
    (job?.path ? job.path.split("/").pop() ?? job.path : null) ||
    null;

  let printTimeSeconds: number | null = null;
  if (typeof job?.time_printing === "number") {
    printTimeSeconds = job.time_printing;
  }

  let connectionStatus: NormalizedTelemetry["connectionStatus"] = online ? "connected" : "disconnected";
  if (effectiveState === "error") connectionStatus = "error";

  return {
    connectionStatus,
    printerState: effectiveState,
    jobName: activeJob ? jobName : null,
    progressPercent: activeJob && progress !== null ? progress : null,
    printTimeSeconds: activeJob ? printTimeSeconds : null,
    errorMessage:
      effectiveState === "error" ? printer.state_reason?.trim() || "Yazıcı hata durumunda" : null,
    raw: { vendor: "prusa", deviceId, printer },
  };
}

export async function prusaFetchTelemetry(
  credentials: { apiKey: string | null; accessToken: string | null },
  deviceId: string
): Promise<NormalizedTelemetry> {
  const token = bearerToken(credentials);
  const printer = await prusaFetch<PrusaPrinterJson>(token, `/app/printers/${deviceId}`);
  return normalizePrusaTelemetry(printer, deviceId);
}
