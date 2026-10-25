import { normalizeMac } from "./net.mjs";

/** Köprü sürücüsü olan markalar (src/lib/bridge/vendors.ts ile aynı liste). */
export const DRIVER_VENDORS = [
  "bambu",
  "creality",
  "anycubic",
  "elegoo",
  "flashforge",
  "snapmaker",
  "klipper",
  "octoprint",
  "prusalink",
];

export const VENDOR_LABELS = {
  bambu: "Bambu Lab",
  creality: "Creality",
  anycubic: "Anycubic",
  elegoo: "Elegoo",
  flashforge: "Flashforge",
  snapmaker: "Snapmaker",
  klipper: "Klipper (Moonraker)",
  octoprint: "OctoPrint",
  prusalink: "Prusa (PrusaLink)",
  ultimaker: "UltiMaker",
  formlabs: "Formlabs",
};

/** Eşleştirmede yerel olarak sorulacak sır (buluta gönderilmez). */
export const VENDOR_SECRET = {
  bambu: "bambu_access_code",
  prusalink: "prusalink_password",
  octoprint: "octoprint_api_key",
};

const BAMBU_NOTE_SLICER = "Erişim kodu Bambu Studio/OrcaSlicer ayarlarında bulundu.";
const BAMBU_NOTE_NEEDS_CODE =
  "Erişim kodu gerekli (8 karakter): yazıcı ekranı → Ayarlar → Ağ/WLAN → LAN Only / Access Code.";
const BAMBU_NOTE_CLOUD_ALT =
  "Kod girmeden: PrintFlow panelinde Makineler → Yazıcıları bağla ile Bambu hesabını bağlayın (bulut telemetri, köprü gerekmez) veya köprüde --bambu-token / --use-slicer-token ile kodu Bambu hesabından yerelde alın.";
const BAMBU_NOTE_CLOUD_MODE =
  "Yazıcı bulut modunda: yerel MQTT erişim koduyla okunabilir; bağlantı reddedilirse LAN Only (yeni firmware'de Developer Mode) açın.";

/** Bambu yazıcılarda yerel olarak elde edilen kodları işaretler (kodlar şemaya yazılmaz). */
export function markAccessCodes(printers, codes, sourceLabel) {
  for (const p of printers) {
    if (p.vendor !== "bambu" || p.secretAvailable || !p.serial || !codes.has(p.serial)) continue;
    p.secretAvailable = true;
    p.notes = p.notes.filter((n) => n !== BAMBU_NOTE_NEEDS_CODE && n !== BAMBU_NOTE_CLOUD_ALT);
    p.notes.unshift(`Erişim kodu ${sourceLabel} üzerinden alındı (yalnızca bu bilgisayarda saklanır).`);
  }
  return printers;
}

/** Genel yazılım katmanları — aynı IP'de marka sürücüsü varsa ikincil sıralanır. */
const GENERIC_VENDORS = new Set(["klipper", "octoprint"]);

function cleanSerial(s) {
  if (s == null) return null;
  const v = String(s).trim();
  return v && !/^(unknown|null|none|undefined|0+|x+|(sn)?[_-]?x{2,})$/i.test(v) ? v : null;
}

function keyOf(c) {
  const serial = cleanSerial(c.serial);
  if (serial) return `${c.vendor}|s|${serial.toLowerCase()}`;
  const mac = normalizeMac(c.mac);
  if (mac) return `${c.vendor}|m|${mac}`;
  return `${c.vendor}|h|${c.host}`;
}

function mergeTwo(a, b) {
  const pick = (x, y) => (x != null && x !== "" ? x : y);
  const methods = [...new Set([...(a.methods ?? []), ...(b.methods ?? [])])];
  const base = Math.max(a.confidence ?? 0, b.confidence ?? 0);
  return {
    ...a,
    host: pick(a.host, b.host),
    serial: pick(cleanSerial(a.serial), cleanSerial(b.serial)),
    mac: pick(normalizeMac(a.mac), normalizeMac(b.mac)),
    model: pick(a.model, b.model),
    name: pick(a.name, b.name),
    lanPort: pick(a.lanPort, b.lanPort),
    authRequired: Boolean(a.authRequired || b.authRequired),
    methods,
    confidence: Math.min(0.99, base + 0.05 * (methods.length - 1)),
    extra: { ...(b.extra ?? {}), ...(a.extra ?? {}) },
  };
}

/**
 * Aynı yazıcı birden çok yöntemle bulunabilir (SSDP + TLS probu, mDNS + HTTP probu…).
 * Önce marka+seri, sonra marka+MAC, sonra marka+IP ile birleştirir; serisiz bir kayıt
 * aynı marka+IP'deki serili kayda katılır.
 */
export function mergeCandidates(list) {
  const items = list.filter((c) => c && c.vendor && c.host);
  const byKey = new Map();
  for (const c of items) {
    const k = keyOf(c);
    byKey.set(k, byKey.has(k) ? mergeTwo(byKey.get(k), c) : { ...c });
  }
  let merged = [...byKey.values()];
  const strong = merged.filter((c) => cleanSerial(c.serial) || normalizeMac(c.mac));
  const weak = merged.filter((c) => !cleanSerial(c.serial) && !normalizeMac(c.mac));
  const out = [...strong];
  for (const w of weak) {
    const i = out.findIndex((s) => s.vendor === w.vendor && s.host === w.host);
    if (i >= 0) out[i] = mergeTwo(out[i], w);
    else out.push(w);
  }
  // Aynı MAC farklı IP (ör. Wi-Fi + Ethernet aynı yazıcı) — aynı marka için tek kayıt.
  merged = [];
  for (const c of out) {
    const mac = normalizeMac(c.mac);
    const i = mac ? merged.findIndex((m) => m.vendor === c.vendor && normalizeMac(m.mac) === mac) : -1;
    if (i >= 0) merged[i] = mergeTwo(merged[i], c);
    else merged.push(c);
  }
  return merged;
}

function samePrinter(p, c) {
  if (p.vendor !== c.vendor) return false;
  if (p.serial && c.serial && String(p.serial).toLowerCase() === String(c.serial).toLowerCase()) return true;
  const pm = normalizeMac(p.mac);
  if (pm && pm === normalizeMac(c.mac)) return true;
  return false;
}

/** Bulunan aday → genel JSON şeması (sırlar asla dahil edilmez). */
export function finalizeCandidates(merged, { pairedPrinters = [], slicerCodes = new Map() } = {}) {
  const printers = merged.map((c) => {
    const serial = cleanSerial(c.serial);
    const mac = normalizeMac(c.mac);
    const supported = DRIVER_VENDORS.includes(c.vendor);
    const paired = pairedPrinters.find((p) => samePrinter(p, { ...c, serial, mac }));
    let needsSecret = VENDOR_SECRET[c.vendor] ?? null;
    if (c.vendor === "klipper" && c.authRequired) needsSecret = "moonraker_api_key";
    const notes = [];
    if (!supported) notes.push("Bu cihaz bulundu ama köprü sürücüsü henüz yok; telemetri okunamaz.");
    const cloudAlternative = c.vendor === "bambu" && c.extra?.connectMode !== "lan";
    if (c.vendor === "bambu") {
      if (slicerCodes.has(serial)) notes.push(BAMBU_NOTE_SLICER);
      else {
        notes.push(BAMBU_NOTE_NEEDS_CODE);
        if (cloudAlternative) notes.push(BAMBU_NOTE_CLOUD_ALT);
      }
      if (c.extra?.connectMode === "cloud") notes.push(BAMBU_NOTE_CLOUD_MODE);
    }
    if (c.vendor === "prusalink") notes.push("PrusaLink şifresi gerekli: yazıcı ekranı → Ayarlar → Ağ → PrusaLink.");
    if (c.vendor === "octoprint") notes.push("OctoPrint arayüzünde erişim isteğini onaylamanız istenecek.");
    if (needsSecret === "moonraker_api_key") {
      notes.push("Moonraker yetki istiyor: API anahtarı girin veya moonraker.conf trusted_clients'a bu bilgisayarı ekleyin.");
    }
    if (!serial && !mac && supported) notes.push("Seri/MAC okunamadı; eşleştirmede IP tabanlı kimlik kullanılacak.");
    const id = `${c.vendor}:${serial ?? mac ?? c.host}`;
    return {
      id,
      vendor: c.vendor,
      vendorLabel: VENDOR_LABELS[c.vendor] ?? c.vendor,
      supported,
      host: c.host,
      serial,
      mac,
      model: c.model ?? null,
      name: c.name ?? null,
      lanPort: c.lanPort ?? null,
      methods: c.methods ?? [],
      confidence: Math.round((c.confidence ?? 0.5) * 100) / 100,
      needsSecret,
      secretAvailable: c.vendor === "bambu" ? slicerCodes.has(serial) : false,
      cloudAlternative,
      paired: Boolean(paired),
      machineId: paired?.machineId ?? null,
      notes,
    };
  });
  const hostHasNative = new Set(printers.filter((p) => !GENERIC_VENDORS.has(p.vendor)).map((p) => p.host));
  for (const p of printers) {
    if (GENERIC_VENDORS.has(p.vendor) && hostHasNative.has(p.host)) {
      p.notes.push("Aynı IP'de marka sürücüsü de bulundu; genelde marka seçeneğini tercih edin.");
    }
  }
  return printers.sort(
    (a, b) =>
      Number(b.supported) - Number(a.supported) ||
      Number(a.paired) - Number(b.paired) ||
      Number(GENERIC_VENDORS.has(a.vendor)) - Number(GENERIC_VENDORS.has(b.vendor)) ||
      b.confidence - a.confidence ||
      a.host.localeCompare(b.host, undefined, { numeric: true })
  );
}

/**
 * Otomatik / "tümü" seçimi için: aynı IP'de marka sürücüsü varsa Klipper/OctoPrint kaydı
 * aynı fiziksel yazıcının ikinci yüzüdür — elenir (kullanıcı listeden yine elle seçebilir).
 */
export function primaryCandidates(printers) {
  const nativeHosts = new Set(printers.filter((p) => p.supported && !GENERIC_VENDORS.has(p.vendor)).map((p) => p.host));
  return printers.filter((p) => !(GENERIC_VENDORS.has(p.vendor) && nativeHosts.has(p.host)));
}

/** Eşleştirme API'si seri ister; seri/MAC yoksa marka+IP tabanlı kararlı kimlik. */
export function pairingSerial(p) {
  return p.serial ?? (p.mac ? p.mac.replace(/:/g, "").toUpperCase() : `${p.vendor}-${p.host}`);
}
