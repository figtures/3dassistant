import { randomUUID } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { resolveVendorModel } from "./device-catalog";
import type { CloudDevice, NormalizedTelemetry, PrinterState } from "./types";
import { CloudAuthError } from "./errors";

const REQUEST_TIMEOUT_MS = 25_000;

const LOGIN_BASE =
  process.env.CREALITY_LOGIN_API_BASE?.trim() || "https://model-admin2.creality.com";
const API_BASE = process.env.CREALITY_API_BASE?.trim() || "https://api.crealitycloud.com";

export type CrealityCredentials = {
  accessToken: string | null;
  refreshToken: string | null;
  apiKey: string | null;
};

type CrealityApiResponse<T = unknown> = {
  code?: number;
  msg?: string;
  result?: T;
};

type LocalDeviceEntry = {
  device_unique_id?: string;
  name?: string;
  model?: string;
  mac?: string;
  connectType?: number;
  address?: string;
};

type MyPrintRow = {
  printInfo?: {
    deviceName?: string;
    printState?: number;
    printErr?: number;
    printStartTime?: number;
    printEndTime?: number;
    timesLeft?: number;
    timesPrinted?: number;
    printer?: { name?: string };
  };
  gcodeInfo?: { name?: string } | null;
};

function tokenFrom(credentials: CrealityCredentials): string {
  const t = credentials.accessToken?.trim() || credentials.apiKey?.trim();
  if (!t) throw new CloudAuthError("Creality oturumu geçersiz — yeniden bağlayın");
  return t;
}

function userIdFrom(credentials: CrealityCredentials): string {
  const uid = credentials.refreshToken?.trim();
  if (!uid) throw new CloudAuthError("Creality kullanıcı kimliği eksik — hesabı yeniden bağlayın");
  return uid;
}

function crealityHeaders(credentials: CrealityCredentials): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=UTF-8",
    __CXY_APP_ID_: "creality_model",
    __CXY_OS_LANG_: "0",
    __CXY_DUID_: "printflow-cloud",
    __CXY_OS_VER_: "PrintFlow/1.0",
    __CXY_PLATFORM_: "14",
    __CXY_REQUESTID_: randomUUID(),
    __CXY_TOKEN_: tokenFrom(credentials),
    __CXY_UID_: userIdFrom(credentials),
  };
}

async function crealityPost<T>(
  baseUrl: string,
  path: string,
  body: unknown,
  headers: Record<string, string>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let parsed: CrealityApiResponse<T>;
    try {
      parsed = JSON.parse(text) as CrealityApiResponse<T>;
    } catch {
      throw new Error(`Creality yanıtı okunamadı (${res.status})`);
    }
    if (parsed.code !== 0 && parsed.code !== 200) {
      if (parsed.code === 4) {
        throw new CloudAuthError("Creality oturumu geçersiz veya süresi dolmuş");
      }
      throw new Error(parsed.msg?.trim() || `Creality hatası (kod ${parsed.code ?? res.status})`);
    }
    return parsed.result as T;
  } finally {
    clearTimeout(timer);
  }
}

/** E-posta + şifre ile Creality Cloud oturumu (Cura / Creality Print ile aynı uç). */
export async function crealityResolveUserId(accessToken: string): Promise<string> {
  const result = await crealityPost<{ userInfo?: { base?: { userId?: string | number } } }>(
    API_BASE,
    "/api/cxy/v2/user/getInfo",
    {},
    {
      "Content-Type": "application/json; charset=UTF-8",
      __CXY_APP_ID_: "creality_model",
      __CXY_OS_LANG_: "0",
      __CXY_DUID_: "printflow-cloud",
      __CXY_OS_VER_: "PrintFlow/1.0",
      __CXY_PLATFORM_: "14",
      __CXY_REQUESTID_: randomUUID(),
      __CXY_TOKEN_: accessToken,
      __CXY_UID_: "0",
    }
  );
  const uid = result?.userInfo?.base?.userId;
  if (uid == null || String(uid).trim() === "") {
    throw new Error("Creality kullanıcı kimliği alınamadı");
  }
  return String(uid);
}

export async function crealityLoginWithPassword(input: {
  email: string;
  password: string;
}): Promise<{ accessToken: string; userId: string }> {
  const email = input.email.trim();
  const password = input.password;
  if (!email || !password) {
    throw new Error("Creality e-posta ve şifre gerekli");
  }

  const result = await crealityPost<{ token?: string; userId?: string | number }>(
    LOGIN_BASE,
    "/api/account/loginV2",
    { type: 2, account: email, password },
    {
      "Content-Type": "application/json; charset=UTF-8",
      __CXY_APP_ID_: "creality_model",
      __CXY_OS_LANG_: "0",
      __CXY_DUID_: "printflow-cloud",
      __CXY_OS_VER_: "PrintFlow/1.0",
      __CXY_PLATFORM_: "14",
      __CXY_REQUESTID_: randomUUID(),
    }
  );

  const accessToken = result?.token?.trim();
  const userId = result?.userId != null ? String(result.userId) : "";
  if (!accessToken || !userId) {
    throw new Error(
      "Creality girişi tamamlanamadı — e-posta doğrulama kodu gerekebilir (Creality Print ile giriş yapıp erişim jetonunu yapıştırın)"
    );
  }
  return { accessToken, userId };
}

function parseDeviceArchive(bytes: Uint8Array): { accounts?: { my_devices?: LocalDeviceEntry[] }[] } {
  const asText = strFromU8(bytes).trim();
  if (asText.startsWith("{")) {
    return JSON.parse(asText) as { accounts?: { my_devices?: LocalDeviceEntry[] }[] };
  }
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const files = unzipSync(bytes);
    for (const name of Object.keys(files)) {
      if (!name.endsWith(".json")) continue;
      const inner = strFromU8(files[name]!).trim();
      if (inner.startsWith("{")) {
        return JSON.parse(inner) as { accounts?: { my_devices?: LocalDeviceEntry[] }[] };
      }
    }
  }
  throw new Error("Creality cihaz profili okunamadı (JSON/ZIP)");
}

async function fetchLocalDeviceProfile(credentials: CrealityCredentials): Promise<LocalDeviceEntry[]> {
  const headers = crealityHeaders(credentials);
  const list = await crealityPost<{ list?: { type?: string; zipUrl?: string }[] }>(
    API_BASE,
    "/api/cxy/v2/slice/profile/user/list",
    { version: "" },
    headers
  );

  const localProfile = (list.list ?? []).find((p) => p.type === "local_device" && p.zipUrl);
  if (!localProfile?.zipUrl) {
    return [];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(localProfile.zipUrl, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`Creality profil indirilemedi (${res.status})`);
    const buf = new Uint8Array(await res.arrayBuffer());
    const doc = parseDeviceArchive(buf);
    const devices: LocalDeviceEntry[] = [];
    for (const account of doc.accounts ?? []) {
      for (const d of account.my_devices ?? []) {
        if (d.device_unique_id) devices.push(d);
      }
    }
    return devices;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMyPrints(credentials: CrealityCredentials): Promise<MyPrintRow[]> {
  const headers = crealityHeaders(credentials);
  const result = await crealityPost<{ list?: MyPrintRow[] }>(
    API_BASE,
    "/api/cxy/v2/print/myPrints",
    { version: 1 },
    headers
  );
  return result.list ?? [];
}

export type IotRpcSnapshot = {
  printProgress?: number;
  dProgress?: number;
  print?: string | number;
  state?: number | string;
  pause?: number | boolean;
  printJobTime?: number;
  printLeftTime?: number;
  err?: number | string;
  online?: boolean;
  gcodeName?: string;
};

type IotRpcResult = IotRpcSnapshot;

async function fetchIotSnapshot(
  credentials: CrealityCredentials,
  deviceId: string
): Promise<IotRpcResult | null> {
  const headers = crealityHeaders(credentials);
  try {
    const raw = await crealityPost<{ data?: IotRpcResult } | IotRpcResult>(
      API_BASE,
      `/api/rest/iotrouter/rpc/twoway/${encodeURIComponent(deviceId)}`,
      { method: "get", params: {} },
      headers
    );
    if (raw && typeof raw === "object" && "data" in raw && raw.data) {
      return raw.data as IotRpcResult;
    }
    return raw as IotRpcResult;
  } catch {
    return null;
  }
}

export function mapCrealityPrintState(
  printState: number | undefined,
  iot: IotRpcResult | null,
  onlineHint: boolean
): PrinterState {
  if (!onlineHint && !iot) return "offline";
  if (iot?.err && Number(iot.err) !== 0) return "error";
  if (iot?.pause === 1 || iot?.pause === true) return "paused";
  const printFlag = iot?.print;
  if (printFlag === 1 || printFlag === "1" || printFlag === "printing") return "printing";

  if (printState === 1) return "printing";
  if (printState === 4) return "paused";
  if (printState === 2) return "idle";
  if (iot?.state != null) {
    const s = String(iot.state);
    if (s === "1" || s.toLowerCase().includes("print")) return "printing";
    if (s === "4" || s.toLowerCase().includes("pause")) return "paused";
  }
  return onlineHint ? "idle" : "offline";
}

function activePrintForDevice(rows: MyPrintRow[], deviceId: string): MyPrintRow | null {
  const matches = rows.filter((r) => r.printInfo?.deviceName === deviceId);
  const active = matches.find(
    (r) => r.printInfo?.printState === 1 && (r.printInfo.printEndTime ?? 0) === 0
  );
  if (active) return active;
  const paused = matches.find((r) => r.printInfo?.printState === 4);
  return paused ?? matches[0] ?? null;
}

export function normalizeCrealityTelemetry(
  deviceId: string,
  deviceName: string,
  iot: IotRpcResult | null,
  printRow: MyPrintRow | null,
  onlineHint: boolean
): NormalizedTelemetry {
  const printState = printRow?.printInfo?.printState;
  const printerState = mapCrealityPrintState(printState, iot, onlineHint);
  const active = printerState === "printing" || printerState === "paused";

  let progressPercent: number | null = null;
  if (typeof iot?.printProgress === "number") {
    progressPercent = Math.min(100, Math.max(0, iot.printProgress));
  } else if (typeof iot?.dProgress === "number") {
    progressPercent = Math.min(100, Math.max(0, iot.dProgress));
  }

  let printTimeSeconds: number | null = null;
  if (typeof iot?.printJobTime === "number") {
    printTimeSeconds = iot.printJobTime;
  } else if (printRow?.printInfo?.printStartTime) {
    const start = printRow.printInfo.printStartTime;
    if (start > 0) printTimeSeconds = Math.max(0, Math.floor(Date.now() / 1000 - start));
  }

  const jobName =
    printRow?.gcodeInfo?.name?.trim() ||
    iot?.gcodeName?.trim() ||
    printRow?.printInfo?.deviceName ||
    deviceName ||
    null;

  let connectionStatus: NormalizedTelemetry["connectionStatus"] = onlineHint ? "connected" : "disconnected";
  if (printerState === "error") connectionStatus = "error";
  if (printerState === "offline") connectionStatus = "disconnected";

  return {
    connectionStatus,
    printerState,
    jobName: active ? jobName : null,
    progressPercent: active ? progressPercent : null,
    printTimeSeconds: active ? printTimeSeconds : null,
    errorMessage:
      printerState === "error"
        ? String(iot?.err ?? printRow?.printInfo?.printErr ?? "Creality yazıcı hata durumunda")
        : null,
    raw: { vendor: "creality", deviceId, iot, printRow },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asOnline(value: unknown): boolean {
  if (value === true || value === 1 || value === "1" || value === "online") return true;
  return false;
}

function collectLooseDevices(payload: unknown): CloudDevice[] {
  const found: CloudDevice[] = [];
  const seen = new Set<string>();

  const visit = (node: unknown, depth: number) => {
    if (depth > 6 || node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    const obj = asRecord(node);
    if (!obj) return;

    const id = asString(
      obj.device_unique_id ?? obj.deviceId ?? obj.device_id ?? obj.tbId ?? obj.mac ?? obj.id
    );
    const name = asString(obj.name ?? obj.deviceName ?? obj.printerName);
    const modelRaw = asString(obj.model ?? obj.printerModel ?? obj.printer_model);
    if (id && (name || modelRaw || obj.device_unique_id || obj.deviceId || obj.tbId)) {
      if (!seen.has(id)) {
        seen.add(id);
        found.push({
          id,
          name: name || modelRaw || id,
          model: resolveVendorModel("creality", modelRaw || name),
          online:
            asOnline(obj.online) ||
            asOnline(obj.isOnline) ||
            obj.connectType === 1 ||
            obj.connectType === 3,
        });
      }
    }

    for (const key of ["list", "devices", "data", "result", "records", "my_devices", "deviceList"]) {
      if (obj[key] != null) visit(obj[key], depth + 1);
    }
  };

  visit(payload, 0);
  return found;
}

async function fetchDeviceDirectory(credentials: CrealityCredentials): Promise<CloudDevice[]> {
  const headers = crealityHeaders(credentials);
  const paths = [
    "/api/cxy/v2/device/userDeviceList",
    "/api/cxy/v2/iot/device/list",
    "/api/cxy/v2/p2p/device/list",
  ];
  const merged: CloudDevice[] = [];
  await Promise.all(
    paths.map(async (path) => {
      try {
        const result = await crealityPost<unknown>(API_BASE, path, {}, headers);
        merged.push(...collectLooseDevices(result));
      } catch {
        // Resmi olmayan uç — yoksa sessizce diğer kaynaklara düş.
      }
    })
  );
  return merged;
}

function mergeDevices(...groups: CloudDevice[][]): CloudDevice[] {
  const byId = new Map<string, CloudDevice>();
  for (const group of groups) {
    for (const device of group) {
      const prev = byId.get(device.id);
      if (!prev) {
        byId.set(device.id, device);
        continue;
      }
      byId.set(device.id, {
        ...prev,
        name: prev.name || device.name,
        model: prev.model || device.model,
        online: prev.online || device.online,
      });
    }
  }
  return [...byId.values()];
}

export async function crealityListDevices(credentials: CrealityCredentials): Promise<CloudDevice[]> {
  const [profile, directory, prints] = await Promise.all([
    fetchLocalDeviceProfile(credentials).catch(() => [] as LocalDeviceEntry[]),
    fetchDeviceDirectory(credentials),
    fetchMyPrints(credentials).catch(() => [] as MyPrintRow[]),
  ]);

  const fromProfile: CloudDevice[] = profile
    .filter((d) => d.device_unique_id)
    .map((d) => ({
      id: d.device_unique_id!,
      name: d.name?.trim() || d.model?.trim() || d.device_unique_id!,
      model: resolveVendorModel("creality", d.model ?? d.name ?? null),
      online: d.connectType === 1 || d.connectType === 3,
    }));

  const fromPrints: CloudDevice[] = [];
  const printSeen = new Set<string>();
  for (const row of prints) {
    const id = row.printInfo?.deviceName?.trim();
    if (!id || printSeen.has(id)) continue;
    printSeen.add(id);
    fromPrints.push({
      id,
      name: id,
      model: resolveVendorModel("creality", row.printInfo?.printer?.name ?? null),
      online: row.printInfo?.printState === 1,
    });
  }

  return mergeDevices(fromProfile, directory, fromPrints);
}

export async function crealityFetchTelemetry(
  credentials: CrealityCredentials,
  deviceId: string
): Promise<NormalizedTelemetry> {
  const [iot, prints] = await Promise.all([
    fetchIotSnapshot(credentials, deviceId),
    fetchMyPrints(credentials),
  ]);
  const printRow = activePrintForDevice(prints, deviceId);
  const onlineHint = Boolean(iot) || printRow?.printInfo?.printState === 1;
  const name = printRow?.printInfo?.deviceName ?? deviceId;
  return normalizeCrealityTelemetry(deviceId, name, iot, printRow, onlineHint);
}
