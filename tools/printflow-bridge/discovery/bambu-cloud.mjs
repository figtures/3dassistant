import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { slicerAppDirs, parseSlicerConf } from "./slicer-secrets.mjs";

/**
 * Bambu hesabından LAN erişim kodu (dev_access_code) — yalnızca atölye bilgisayarında, Bambu'nun
 * kendi API'sine doğrudan. Kod/jeton PrintFlow bulutuna, JSON çıktısına veya loglara yazılmaz.
 */

export const BAMBU_API_BASES = { global: "https://api.bambulab.com", cn: "https://api.bambulab.cn" };

const CODE_RE = /^[0-9A-Za-z]{6,16}$/;
const SERIAL_RE = /^[0-9A-Z]{8,20}$/;
const TOKEN_KEY_RE = /^(access_?token|token|user_?token|auth_?token)$/i;
const TOKEN_RE = /^[A-Za-z0-9._\-+/=]{20,4096}$/;

/** Bambu Studio ağ eklentisinin oturum dosyası (+ ana .conf) adayları. */
export function slicerTokenPaths(...args) {
  const out = [];
  for (const { app, dir, conf } of slicerAppDirs(...args)) {
    out.push({ app, path: join(dir, "BambuNetworkEngine.conf") });
    out.push({ app, path: join(dir, conf) });
  }
  return out;
}

/** Onay istemeden önce yalnızca varlık kontrolü (dosya okunmaz). */
export function slicerSessionApp(paths = slicerTokenPaths()) {
  return paths.find((p) => p.path.endsWith("BambuNetworkEngine.conf") && existsSync(p.path))?.app ?? null;
}

/** JSON belgesinde bulut oturum jetonu (anahtar adı token/access_token…). */
export function findTokenInDoc(doc) {
  let found = null;
  const visit = (node, depth) => {
    if (found || !node || typeof node !== "object" || depth > 6) return;
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === "string" && TOKEN_KEY_RE.test(k) && TOKEN_RE.test(v.trim())) {
        found = v.trim();
        return;
      }
      if (v && typeof v === "object") visit(v, depth + 1);
    }
  };
  visit(doc, 0);
  return found;
}

/**
 * Dilimleyicinin yerel Bambu oturumu. status: found | encrypted (dosya var, okunamıyor) | missing.
 * Yalnızca kullanıcı onayıyla çağrılmalı; jeton döndürülür ama hiçbir yere yazılmaz.
 */
export function readSlicerCloudToken(paths = slicerTokenPaths()) {
  let status = "missing";
  let app = null;
  for (const p of paths) {
    if (!existsSync(p.path)) continue;
    let doc = null;
    try {
      doc = parseSlicerConf(readFileSync(p.path, "utf8"));
    } catch {
      doc = null;
    }
    const token = doc ? findTokenInDoc(doc) : null;
    if (token) return { status: "found", app: p.app, token };
    if (!doc && p.path.endsWith("BambuNetworkEngine.conf")) {
      status = "encrypted";
      app = p.app;
    }
  }
  return { status, app, token: null };
}

/** `GET /v1/iot-service/api/user/bind` yanıtı → seri → erişim kodu. */
export function accessCodesFromBind(json) {
  const codes = new Map();
  for (const d of json?.devices ?? []) {
    const serial = typeof d?.dev_id === "string" ? d.dev_id.trim() : "";
    const code = typeof d?.dev_access_code === "string" ? d.dev_access_code.trim() : "";
    if (SERIAL_RE.test(serial) && CODE_RE.test(code)) codes.set(serial, code);
  }
  return codes;
}

/** Bambu hesabına bağlı yazıcıların erişim kodları (yerelden Bambu API'sine). */
export async function fetchBambuAccessCodes(token, { region = "global", fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  const base = BAMBU_API_BASES[region] ?? BAMBU_API_BASES.global;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${base}/v1/iot-service/api/user/bind`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "PrintFlow-Bridge" },
      signal: ctrl.signal,
    });
    if (res.status === 401 || res.status === 403) throw new Error("Bambu oturumu geçersiz veya süresi dolmuş");
    if (!res.ok) throw new Error(`Bambu bulut hatası (HTTP ${res.status})`);
    return accessCodesFromBind(await res.json());
  } catch (e) {
    if (e?.name === "AbortError") throw new Error("Bambu bulutuna ulaşılamadı (zaman aşımı)");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
