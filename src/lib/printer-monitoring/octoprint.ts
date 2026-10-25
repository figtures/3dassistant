import type { NormalizedTelemetry, PrinterState } from "./types";

const DEFAULT_TIMEOUT_MS = 12_000;

export class OctoPrintUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OctoPrintUnreachableError";
  }
}

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return trimmed;
}

function mapOctoPrintState(stateText: string | undefined): PrinterState {
  const s = (stateText ?? "").toLowerCase();
  if (s.includes("print")) return "printing";
  if (s.includes("pause")) return "paused";
  if (s.includes("error") || s.includes("fail")) return "error";
  if (s.includes("operational") || s.includes("ready") || s.includes("idle")) return "idle";
  if (s.includes("offline") || s.includes("closed")) return "offline";
  return "unknown";
}

async function octoFetch<T>(
  baseUrl: string,
  path: string,
  apiKey: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const url = `${normalizeBaseUrl(baseUrl)}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new OctoPrintUnreachableError(
        `OctoPrint HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`
      );
    }

    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof OctoPrintUnreachableError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new OctoPrintUnreachableError("OctoPrint zaman aşımı");
    }
    const msg = e instanceof Error ? e.message : "Bilinmeyen ağ hatası";
    throw new OctoPrintUnreachableError(msg);
  } finally {
    clearTimeout(timer);
  }
}

type OctoPrinterResponse = {
  state?: {
    text?: string;
    flags?: {
      printing?: boolean;
      paused?: boolean;
      ready?: boolean;
      operational?: boolean;
      error?: boolean;
    };
  };
  temperature?: unknown;
};

type OctoJobResponse = {
  job?: {
    file?: { name?: string };
    progress?: { completion?: number; printTime?: number; printTimeLeft?: number };
    state?: string;
  };
  progress?: { completion?: number; printTime?: number };
  state?: string;
};

export async function testOctoPrintConnection(
  baseUrl: string,
  apiKey: string
): Promise<{ ok: true; version?: string } | { ok: false; error: string }> {
  try {
    const data = await octoFetch<{ server?: string; version?: string }>(
      baseUrl,
      "/api/version",
      apiKey,
      8_000
    );
    return { ok: true, version: data.version ?? data.server };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Bağlantı başarısız",
    };
  }
}

export async function fetchOctoPrintTelemetry(
  baseUrl: string,
  apiKey: string
): Promise<NormalizedTelemetry> {
  const [printer, job] = await Promise.all([
    octoFetch<OctoPrinterResponse>(baseUrl, "/api/printer", apiKey),
    octoFetch<OctoJobResponse>(baseUrl, "/api/job", apiKey),
  ]);

  const flags = printer.state?.flags;
  let printerState = mapOctoPrintState(printer.state?.text);
  if (flags?.paused) printerState = "paused";
  else if (flags?.printing) printerState = "printing";
  else if (flags?.error) printerState = "error";
  else if (flags?.operational || flags?.ready) printerState = printerState === "unknown" ? "idle" : printerState;

  const jobState = (job.job?.state ?? job.state ?? "").toLowerCase();
  if (jobState.includes("print") && printerState === "idle") printerState = "printing";

  const completion =
    job.progress?.completion ??
    job.job?.progress?.completion ??
    null;
  const progressPercent =
    completion != null && !Number.isNaN(Number(completion))
      ? Math.min(100, Math.max(0, Number(completion)))
      : null;

  const printTimeSeconds =
    job.progress?.printTime ??
    job.job?.progress?.printTime ??
    null;

  const jobName = job.job?.file?.name?.trim() || null;

  return {
    connectionStatus: "connected",
    printerState,
    jobName,
    progressPercent,
    printTimeSeconds: printTimeSeconds != null ? Math.round(Number(printTimeSeconds)) : null,
    errorMessage: printerState === "error" ? printer.state?.text ?? "Yazıcı hata durumunda" : null,
    raw: { printer, job },
  };
}
