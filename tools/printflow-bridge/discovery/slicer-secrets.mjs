import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CODE_RE = /^[0-9A-Za-z]{6,16}$/;
const SERIAL_RE = /^[0-9A-Z]{8,20}$/;

/** Bambu Studio / OrcaSlicer veri klasörleri (platforma göre; Linux'ta Flatpak dahil). */
export function slicerAppDirs(platform = process.platform, env = process.env, home = homedir()) {
  const apps = [
    ["BambuStudio", "BambuStudio.conf", "com.bambulab.BambuStudio"],
    ["OrcaSlicer", "OrcaSlicer.conf", "io.github.softfever.OrcaSlicer"],
  ];
  let base;
  if (platform === "darwin") base = join(home, "Library", "Application Support");
  else if (platform === "win32") base = env.APPDATA || join(home, "AppData", "Roaming");
  else base = env.XDG_CONFIG_HOME || join(home, ".config");
  const out = apps.map(([app, conf]) => ({ app, dir: join(base, app), conf }));
  if (platform !== "darwin" && platform !== "win32") {
    for (const [app, conf, flatpak] of apps) {
      out.push({ app, dir: join(home, ".var", "app", flatpak, "config", app), conf });
    }
  }
  return out;
}

/** Bambu Studio / OrcaSlicer yapılandırma dosyası adayları (platforma göre). */
export function slicerConfigPaths(platform = process.platform, env = process.env, home = homedir()) {
  return slicerAppDirs(platform, env, home).map(({ app, dir, conf }) => ({ app, path: join(dir, conf) }));
}

/** `.conf` JSON + sonda `# MD5 checksum …` satırı olabilir; yorum satırlarını atarak parse. */
export function parseSlicerConf(text) {
  const cleaned = String(text)
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n");
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Yapılandırmadan seri → erişim kodu. Biçim sürümler arasında değişebildiği için
 * anahtar adında "access_code" geçen nesneleri ve {dev_id, access_code} dizilerini arar.
 */
export function extractAccessCodes(doc) {
  const out = new Map();
  const visit = (node, keyHint, depth) => {
    if (!node || typeof node !== "object" || depth > 8) return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n, keyHint, depth + 1);
      return;
    }
    const devId = node.dev_id ?? node.dev_sn ?? node.serial;
    const code = node.access_code ?? node.dev_access_code;
    if (typeof devId === "string" && typeof code === "string" && SERIAL_RE.test(devId) && CODE_RE.test(code)) {
      out.set(devId, code);
    }
    for (const [k, v] of Object.entries(node)) {
      if (/access_code/i.test(k) && v && typeof v === "object" && !Array.isArray(v)) {
        for (const [serial, c] of Object.entries(v)) {
          if (SERIAL_RE.test(serial) && typeof c === "string" && CODE_RE.test(c)) out.set(serial, c);
        }
      } else if (typeof v === "object") {
        visit(v, k, depth + 1);
      }
    }
  };
  visit(doc, "", 0);
  return out;
}

/** Yerel dilimleyici ayarlarından erişim kodları (yalnızca okuma; hiçbir yere gönderilmez). */
export function readSlicerAccessCodes(paths = slicerConfigPaths()) {
  const codes = new Map();
  const sources = [];
  for (const { app, path } of paths) {
    if (!existsSync(path)) continue;
    try {
      const doc = parseSlicerConf(readFileSync(path, "utf8"));
      if (!doc) continue;
      const found = extractAccessCodes(doc);
      for (const [serial, code] of found) {
        if (!codes.has(serial)) codes.set(serial, code);
      }
      if (found.size && !sources.includes(app)) sources.push(app);
    } catch {
      /* okunamadı — atla */
    }
  }
  return { codes, sources };
}
