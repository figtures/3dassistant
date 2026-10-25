import { resolveVendorModel } from "./device-catalog";
import type { CloudDevice, NormalizedTelemetry, PrinterState } from "./types";
import { CloudAuthError } from "./errors";

const BAMBU_API_BASE = "https://api.bambulab.com";
const REQUEST_TIMEOUT_MS = 20_000;

const BBL_HEADERS = {
  "User-Agent": "PrintFlow/1.0",
  "X-BBL-Client-Name": "PrintFlow",
  "X-BBL-Client-Type": "web",
  Accept: "application/json",
} as const;

export type BambuBindDevice = {
  dev_id?: string;
  name?: string;
  online?: boolean;
  print_status?: string;
  dev_model_name?: string;
  dev_product_name?: string;
  print_job?: number | string;
};

type BambuTaskHit = {
  id?: number;
  title?: string;
  status?: number;
  startTime?: string;
  endTime?: string;
  costTime?: number;
  deviceId?: string;
};

function bearerToken(credentials: { accessToken: string | null; apiKey: string | null }): string {
  const token = credentials.accessToken?.trim() || credentials.apiKey?.trim();
  if (!token) {
    throw new CloudAuthError("Bambu oturumu geçersiz — yeniden bağlayın");
  }
  return token;
}

async function bambuFetch<T>(token: string, path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BAMBU_API_BASE}${path}`, {
      method: "GET",
      headers: {
        ...BBL_HEADERS,
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      throw new CloudAuthError("Bambu oturumu süresi doldu — hesabı yeniden bağlayın");
    }
    if (!res.ok) {
      throw new Error(`Bambu Bulut hatası (${res.status})`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function mapBambuPrintStatus(raw: string | undefined | null, online: boolean): PrinterState {
  if (!online) return "offline";
  const s = (raw ?? "").toUpperCase();
  if (s.includes("PRINT") || s === "RUNNING" || s === "BUSY") return "printing";
  if (s.includes("PAUSE")) return "paused";
  if (s.includes("FAIL") || s.includes("ERROR") || s === "FAILED") return "error";
  if (s === "IDLE" || s === "SUCCESS" || s === "FINISH" || s === "FINISHED" || s === "READY") {
    return "idle";
  }
  return "unknown";
}

function taskLooksActive(task: BambuTaskHit): boolean {
  if (task.status === 2) return false;
  if (!task.startTime) return false;
  if (!task.endTime) return true;
  const start = Date.parse(task.startTime);
  const end = Date.parse(task.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return end - start > 60_000;
}

function estimateProgress(task: BambuTaskHit): number | null {
  if (!taskLooksActive(task)) return null;
  if (typeof task.costTime !== "number" || task.costTime <= 0) return null;
  if (!task.startTime) return null;
  const elapsed = (Date.now() - Date.parse(task.startTime)) / 1000;
  if (!Number.isFinite(elapsed) || elapsed <= 0) return null;
  return Math.min(99, Math.max(1, Math.round((elapsed / task.costTime) * 100)));
}

/** İsteğe bağlı: e-posta + şifre (+ e-posta doğrulama kodu) ile JWT. Resmi olmayan uç; tercih OAuth veya yapıştırılan token. */
export async function bambuLoginWithPassword(input: {
  account: string;
  password: string;
  verificationCode?: string;
}): Promise<{ accessToken: string; refreshToken: string | null }> {
  const body = input.verificationCode?.trim()
    ? { account: input.account.trim(), code: input.verificationCode.trim() }
    : { account: input.account.trim(), password: input.password };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BAMBU_API_BASE}/v1/user-service/user/login`, {
      method: "POST",
      headers: { ...BBL_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
      loginType?: string;
      message?: string;
    };
    if (!res.ok || !data.accessToken) {
      if (data.loginType === "verifyCode") {
        throw new Error("Bambu e-posta doğrulama kodu gerekli — kodu girin veya Bambu OAuth kullanın");
      }
      throw new Error(data.message?.trim() || "Bambu girişi başarısız");
    }
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function bambuFetchBindDevices(token: string): Promise<BambuBindDevice[]> {
  const data = await bambuFetch<{ devices?: BambuBindDevice[] }>(
    token,
    "/v1/iot-service/api/user/bind"
  );
  return data.devices ?? [];
}

export async function bambuListDevices(credentials: {
  accessToken: string | null;
  apiKey: string | null;
}): Promise<CloudDevice[]> {
  const token = bearerToken(credentials);
  const devices = await bambuFetchBindDevices(token);
  return devices
    .filter((d) => d.dev_id)
    .map((d) => ({
      id: d.dev_id!,
      name: d.name?.trim() || `Bambu ${d.dev_id!.slice(0, 8)}`,
      model: resolveVendorModel("bambu", d.dev_product_name ?? d.dev_model_name ?? null),
      online: Boolean(d.online),
    }));
}

export async function bambuFetchLatestTask(
  token: string,
  deviceId: string,
  preferredJobId?: number | string | null
): Promise<BambuTaskHit | null> {
  const data = await bambuFetch<{ hits?: BambuTaskHit[] }>(
    token,
    `/v1/user-service/my/tasks?deviceId=${encodeURIComponent(deviceId)}&limit=20`
  );
  const hits = data.hits ?? [];
  if (preferredJobId != null) {
    const match = hits.find((h) => String(h.id) === String(preferredJobId));
    if (match) return match;
  }
  const active = hits.find((h) => taskLooksActive(h));
  return active ?? hits[0] ?? null;
}

export function normalizeBambuTelemetry(
  device: BambuBindDevice,
  task: BambuTaskHit | null,
  deviceId: string
): NormalizedTelemetry {
  const online = Boolean(device.online);
  const printerState = mapBambuPrintStatus(device.print_status, online);
  const active = task ? taskLooksActive(task) : printerState === "printing";
  const progress = active && task ? estimateProgress(task) : null;
  const printTimeSeconds =
    active && task?.startTime
      ? Math.max(0, Math.floor((Date.now() - Date.parse(task.startTime)) / 1000))
      : null;

  let connectionStatus: NormalizedTelemetry["connectionStatus"] = online ? "connected" : "disconnected";
  if (printerState === "error") connectionStatus = "error";

  return {
    connectionStatus,
    printerState: online ? printerState : "offline",
    jobName: active ? task?.title?.trim() || null : null,
    progressPercent: progress,
    printTimeSeconds,
    errorMessage: printerState === "error" ? "Bambu yazıcı hata durumunda" : null,
    raw: { vendor: "bambu", deviceId, device, task },
  };
}

export async function bambuFetchTelemetry(
  credentials: { accessToken: string | null; apiKey: string | null },
  deviceId: string
): Promise<NormalizedTelemetry> {
  const token = bearerToken(credentials);
  const devices = await bambuFetchBindDevices(token);
  const device = devices.find((d) => d.dev_id === deviceId);
  if (!device) {
    throw new Error("Bambu cihazı bulunamadı");
  }
  const task = await bambuFetchLatestTask(token, deviceId, device.print_job);
  return normalizeBambuTelemetry(device, task, deviceId);
}
