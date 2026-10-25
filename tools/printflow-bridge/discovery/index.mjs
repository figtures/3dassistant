import { listScanInterfaces, hostsInCidr, tcpOpen, mapLimit, readArpTable } from "./net.mjs";
import { discoverBambuSsdp } from "./ssdp.mjs";
import { discoverMdns } from "./mdns.mjs";
import { discoverSdcp, discoverSnapmaker, discoverFlashforge } from "./udp-vendors.mjs";
import { probeHost, verifyCandidate, SCAN_PORTS } from "./probes.mjs";
import { mergeCandidates, finalizeCandidates, DRIVER_VENDORS } from "./merge.mjs";

export const DISCOVERY_SCHEMA_VERSION = 1;

/** /24 başına bilinen portlar; kısa zaman aşımı + eşzamanlılık sınırı. */
export async function portScan(interfaces, { ports = SCAN_PORTS, concurrency = 192, timeoutMs = 450, maxHosts = 1024, onProgress } = {}) {
  const own = new Set(interfaces.map((i) => i.address));
  const hosts = [...new Set(interfaces.flatMap((i) => hostsInCidr(i.cidr, { exclude: [...own] })))].slice(0, maxHosts);
  const jobs = hosts.flatMap((h) => ports.map((p) => [h, p]));
  const open = new Map();
  let done = 0;
  await mapLimit(jobs, concurrency, async ([h, p]) => {
    if (await tcpOpen(h, p, timeoutMs)) {
      const list = open.get(h) ?? [];
      list.push(p);
      open.set(h, list);
    }
    done++;
    if (onProgress && done % 256 === 0) onProgress({ phase: "scan", done, total: jobs.length });
  });
  const candidates = [];
  await mapLimit([...open.entries()], 16, async ([h, openPorts]) => {
    const r = await probeHost(h, { openPorts });
    candidates.push(...r.candidates);
  });
  return { method: "scan", candidates, errors: [], scannedHosts: hosts.length, liveHosts: open.size };
}

function emptyResult(method, e) {
  return { method, candidates: [], errors: [e instanceof Error ? e.message : String(e)] };
}

/**
 * Tüm yöntemler: Bambu SSDP, mDNS (Creality/Klipper/OctoPrint/Prusa…), Elegoo SDCP,
 * Snapmaker UDP, Flashforge UDP; gerekirse bilinen-port taraması; elle girilen IP'ler.
 *
 * @param {object} opts
 * @param {number} [opts.timeoutMs] yayın dinleme süresi
 * @param {"auto"|"always"|"never"} [opts.scan] auto = yayınla hiç desteklenen yazıcı bulunmazsa tara
 * @param {string[]} [opts.hosts] elle IP (misafir ağı / farklı alt ağ)
 * @param {Array} [opts.pairedPrinters] config.printers — listede "eşleşmiş" işareti
 * @param {Map} [opts.slicerCodes] seri → erişim kodu (yalnızca "mevcut" bilgisi için)
 */
export async function discoverPrinters(opts = {}) {
  const started = Date.now();
  const {
    timeoutMs = 6000,
    scan = "auto",
    hosts = [],
    pairedPrinters = [],
    slicerCodes = new Map(),
    onProgress = () => {},
  } = opts;
  const interfaces = opts.interfaces ?? listScanInterfaces();
  const warnings = [];
  if (!interfaces.length) {
    warnings.push(
      "Özel ağ (192.168.x / 10.x / 172.16-31.x) arayüzü bulunamadı. Bilgisayar yazıcıyla aynı Wi-Fi/Ethernet ağında mı? VPN açıksa kapatıp deneyin."
    );
  }

  onProgress({ phase: "broadcast" });
  const short = Math.min(timeoutMs, 3500);
  const settled = await Promise.all([
    discoverBambuSsdp({ timeoutMs, interfaces }).catch((e) => emptyResult("ssdp", e)),
    discoverMdns({ timeoutMs: short, interfaces }).catch((e) => emptyResult("mdns", e)),
    discoverSdcp({ timeoutMs: Math.min(short, 2500), interfaces }).catch((e) => emptyResult("sdcp", e)),
    discoverSnapmaker({ timeoutMs: Math.min(short, 2500), interfaces }).catch((e) => emptyResult("snapmaker-udp", e)),
    discoverFlashforge({ timeoutMs: Math.min(short, 2500), interfaces }).catch((e) => emptyResult("flashforge-udp", e)),
  ]);

  const methods = {};
  let candidates = [];
  for (const r of settled) {
    methods[r.method] = { count: r.candidates.length, errors: r.errors };
    candidates.push(...r.candidates);
  }

  onProgress({ phase: "verify" });
  const toVerify = candidates.filter((c) => !c.serial || (c.confidence ?? 0) < 0.8);
  const verified = await mapLimit(toVerify, 8, (c) => verifyCandidate(c));
  candidates.push(...verified.filter(Boolean));

  for (const h of hosts) {
    onProgress({ phase: "manual", host: h });
    const r = await probeHost(h, { timeoutMs: 1500 });
    candidates.push(...r.candidates.map((c) => ({ ...c, methods: [...c.methods, "manual"] })));
    if (!r.candidates.length) {
      warnings.push(
        r.openPorts.length
          ? `${h}: açık port var (${r.openPorts.join(", ")}) ama yazıcı tanınmadı.`
          : `${h}: bilinen yazıcı portlarından yanıt yok (IP doğru mu, yazıcı açık mı, aynı ağda mı?).`
      );
    }
  }

  const supportedSoFar = candidates.some((c) => DRIVER_VENDORS.includes(c.vendor));
  const multicastBroken = settled.every((r) => r.errors.length > 0 || r.candidates.length === 0);
  if (interfaces.length && (scan === "always" || (scan === "auto" && !supportedSoFar))) {
    onProgress({ phase: "scan" });
    const r = await portScan(interfaces, { onProgress });
    methods.scan = { count: r.candidates.length, errors: [], scannedHosts: r.scannedHosts, liveHosts: r.liveHosts };
    candidates.push(...r.candidates);
    if (r.candidates.length && multicastBroken) {
      warnings.push(
        "Yazıcı yalnızca port taramasıyla bulundu: ağ/güvenlik duvarı çoklu yayını (UDP 2021, mDNS 5353) engelliyor olabilir. Çalışır ama keşif yavaşlar."
      );
    }
  }

  const arp = await readArpTable();
  for (const c of candidates) {
    if (!c.mac && arp.has(c.host)) c.mac = arp.get(c.host);
  }

  const printers = finalizeCandidates(mergeCandidates(candidates), { pairedPrinters, slicerCodes });
  if (!printers.length) {
    warnings.push(
      "Yazıcı bulunamadı. Kontrol edin: yazıcı açık ve bu bilgisayarla aynı ağda mı (misafir Wi-Fi ayrı ağdır)? Bambu'da LAN Only / Developer Mode, Creality'de yerel ağ erişimi açık mı? macOS'ta Ayarlar → Gizlilik → Yerel Ağ iznini verin. Son çare: IP adresini elle girin (--host IP)."
    );
  }
  return {
    version: DISCOVERY_SCHEMA_VERSION,
    scannedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started,
    interfaces: interfaces.map(({ name, address, cidr }) => ({ name, address, cidr })),
    methods,
    warnings,
    printers,
  };
}

/** Çalışma döngüsü: IP'si değişmiş (DHCP) yazıcıyı seri/MAC ile yeniden bul. */
export async function rediscoverPrinter(printer, { timeoutMs = 5000, scan = "auto" } = {}) {
  const res = await discoverPrinters({ timeoutMs, scan: "never" });
  const match = (list) =>
    list.find(
      (p) =>
        p.vendor === printer.vendor &&
        ((p.serial && printer.serial && p.serial.toLowerCase() === String(printer.serial).toLowerCase()) ||
          (p.mac && printer.mac && p.mac === printer.mac))
    );
  let hit = match(res.printers);
  if (!hit && scan !== "never") {
    const full = await discoverPrinters({ timeoutMs: 1000, scan: "always" });
    hit = match(full.printers);
  }
  return hit ?? null;
}
