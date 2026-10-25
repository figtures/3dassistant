import http from "node:http";
import net from "node:net";
import tls from "node:tls";
import WebSocket from "ws";
import { tcpOpen, normalizeMac } from "./net.mjs";
import {
  discoverSdcp,
  discoverSnapmaker,
  parseFlashforgeM115,
} from "./udp-vendors.mjs";

/** Bilinen yerel API portları → parmak izi probu. Tarama yalnızca bunlara bakar. */
export const SCAN_PORTS = [8883, 9999, 3030, 8899, 7125, 80, 5000, 6000, 8080];

export function httpGet(host, port, path, { timeoutMs = 2500, headers = {} } = {}) {
  return new Promise((resolve) => {
    const req = http.get({ host, port, path, headers, timeout: timeoutMs }, (res) => {
      const chunks = [];
      let size = 0;
      res.on("data", (c) => {
        size += c.length;
        if (size < 512 * 1024) chunks.push(c);
      });
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {
          /* json değil */
        }
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body, json });
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => resolve(null));
  });
}

/** Bambu: 8883 TLS sertifika CN = yazıcı seri numarası. */
export function probeBambuTls(host, { timeoutMs = 3000 } = {}) {
  return new Promise((resolve) => {
    const sock = tls.connect({ host, port: 8883, rejectUnauthorized: false, servername: undefined });
    const done = (v) => {
      sock.removeAllListeners();
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(timeoutMs, () => done(null));
    sock.once("error", () => done(null));
    sock.once("secureConnect", () => {
      const cert = sock.getPeerCertificate();
      const cn = cert?.subject?.CN;
      const issuer = `${cert?.issuer?.O ?? ""} ${cert?.issuer?.CN ?? ""}`;
      const serialLike = typeof cn === "string" && /^[0-9A-Z]{8,20}$/.test(cn);
      if (!serialLike && !/bambu|bbl/i.test(issuer)) return done(null);
      done({
        vendor: "bambu",
        host,
        serial: serialLike ? cn : null,
        model: null,
        name: null,
        methods: ["tls-probe"],
        confidence: serialLike && /bambu|bbl/i.test(issuer) ? 0.9 : 0.7,
        extra: { certSha256: cert?.fingerprint256 ?? null },
      });
    });
  });
}

const CREALITY_KEYS = ["nozzleTemp", "bedTemp0", "printProgress", "deviceState", "modelVersion", "boxTemp", "printFileName"];

export function crealityFromWsMessage(j, host) {
  if (!j || typeof j !== "object") return null;
  const keys = Object.keys(j);
  if (!CREALITY_KEYS.some((k) => keys.includes(k)) && !/creality/i.test(JSON.stringify(j).slice(0, 2000))) {
    return null;
  }
  const serial = j.sn ?? j.SN ?? j.deviceSn ?? j.serial ?? j.deviceId ?? null;
  return {
    vendor: "creality",
    host,
    serial: serial ? String(serial) : null,
    mac: normalizeMac(j.mac ?? j.macAddress),
    model: j.model ?? j.modelVersion ?? null,
    name: j.hostname ?? j.deviceName ?? null,
    lanPort: 9999,
    methods: ["ws-probe"],
    confidence: 0.85,
    extra: {},
  };
}

function wsFirstMessage(url, { timeoutMs = 3500, send = [] } = {}) {
  return new Promise((resolve) => {
    let ws;
    try {
      ws = new WebSocket(url, { handshakeTimeout: timeoutMs });
    } catch {
      return resolve(null);
    }
    const t = setTimeout(() => finish({ opened: true, message: null }), timeoutMs);
    let opened = false;
    const finish = (v) => {
      clearTimeout(t);
      try {
        ws.terminate();
      } catch {
        /* */
      }
      resolve(v);
    };
    ws.on("open", () => {
      opened = true;
      for (const m of send) ws.send(typeof m === "string" ? m : JSON.stringify(m));
    });
    ws.on("message", (data) => {
      let j = null;
      try {
        j = JSON.parse(data.toString());
      } catch {
        /* metin */
      }
      finish({ opened: true, message: j, text: data.toString().slice(0, 4000) });
    });
    ws.on("error", () => finish(opened ? { opened: true, message: null } : null));
  });
}

export async function probeCrealityWs(host, port = 9999) {
  const r = await wsFirstMessage(`ws://${host}:${port}/`, {
    send: [
      { mode: "subscribe", topic: "print" },
      { mode: "subscribe", topic: "status" },
    ],
  });
  if (!r?.message) return null;
  return crealityFromWsMessage(r.message, host);
}

/** Moonraker (Klipper): /printer/info + /machine/system_info → MAC/seri. */
export async function probeMoonraker(host, port = 7125) {
  const info = await httpGet(host, port, "/printer/info");
  if (!info) return null;
  if (info.status === 401 || info.status === 403) {
    return {
      vendor: "klipper",
      host,
      serial: null,
      model: null,
      name: null,
      lanPort: port,
      methods: ["http-probe"],
      confidence: 0.6,
      authRequired: true,
      extra: {},
    };
  }
  const r = info.json?.result;
  if (!r || (r.state == null && r.klipper_path == null && r.software_version == null)) return null;
  const sys = (await httpGet(host, port, "/machine/system_info"))?.json?.result?.system_info ?? {};
  let mac = null;
  for (const n of Object.values(sys.network ?? {})) {
    mac = normalizeMac(n?.mac_address);
    if (mac) break;
  }
  const cpuSerial = sys.cpu_info?.serial_number;
  const serial = mac ?? (cpuSerial && !/unknown|^0+$/i.test(cpuSerial) ? cpuSerial : null);
  const product = sys.product_info ?? {};
  return {
    vendor: "klipper",
    host,
    serial,
    mac,
    model: product.machine_type ?? product.device_name ?? sys.cpu_info?.model ?? null,
    name: r.hostname ?? null,
    lanPort: port,
    methods: ["http-probe"],
    confidence: 0.9,
    extra: { klippyState: r.state ?? null, software: r.software_version ?? null },
  };
}

/** OctoPrint (appkeys probe 204) veya PrusaLink (Digest realm "Printer API"). */
export async function probeHttpPrinter(host, port = 80) {
  const appkeys = await httpGet(host, port, "/plugin/appkeys/probe");
  if (appkeys?.status === 204) {
    return {
      vendor: "octoprint",
      host,
      serial: null,
      model: null,
      name: null,
      lanPort: port,
      methods: ["http-probe"],
      confidence: 0.9,
      extra: {},
    };
  }
  const ver = await httpGet(host, port, "/api/version");
  if (!ver) return null;
  const auth = String(ver.headers?.["www-authenticate"] ?? "");
  const text = `${ver.json?.text ?? ""} ${ver.json?.server ?? ""} ${auth}`;
  if (/printer api|prusa/i.test(text) || (ver.json && ver.json.printer && /prusa/i.test(ver.json.printer))) {
    return {
      vendor: "prusalink",
      host,
      serial: null,
      model: ver.json?.printer ?? null,
      name: ver.json?.hostname ?? null,
      lanPort: port,
      methods: ["http-probe"],
      confidence: 0.85,
      authRequired: ver.status === 401,
      extra: {},
    };
  }
  if (ver.json?.server && /octoprint/i.test(ver.json?.text ?? "")) {
    return {
      vendor: "octoprint",
      host,
      serial: null,
      model: null,
      name: null,
      lanPort: port,
      methods: ["http-probe"],
      confidence: 0.85,
      extra: {},
    };
  }
  return null;
}

/** Flashforge TCP 8899: `~M601 S1` (kontrol) → `~M115` → `~M602` (bırak). */
export function probeFlashforgeTcp(host, port = 8899, { timeoutMs = 2500 } = {}) {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    let buf = "";
    const done = (v) => {
      sock.removeAllListeners();
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(timeoutMs, () => done(finish()));
    const finish = () => {
      const info = parseFlashforgeM115(buf);
      if (!info) return null;
      return {
        vendor: "flashforge",
        host,
        serial: info.serial,
        mac: normalizeMac(info.mac),
        model: info.machineType,
        name: info.machineName,
        lanPort: 8899,
        methods: ["tcp-probe"],
        confidence: 0.95,
        extra: { firmware: info.firmware },
      };
    };
    sock.once("error", () => done(null));
    sock.once("connect", () => {
      sock.write("~M601 S1\r\n");
      setTimeout(() => sock.write("~M115\r\n"), 150);
    });
    sock.on("data", (d) => {
      buf += d.toString("latin1");
      if (/M115[\s\S]*ok/i.test(buf)) {
        sock.write("~M602\r\n");
        setTimeout(() => done(finish()), 100);
      }
    });
  });
}

export async function probeAnycubicWs(host, port = 6000) {
  const r = await wsFirstMessage(`ws://${host}:${port}/`, { timeoutMs: 2500 });
  if (!r?.opened) return null;
  return {
    vendor: "anycubic",
    host,
    serial: r.message?.sn ?? r.message?.deviceId ?? null,
    model: r.message?.model ?? null,
    name: r.message?.name ?? null,
    lanPort: port,
    methods: ["ws-probe"],
    confidence: r.message ? 0.6 : 0.4,
    extra: {},
  };
}

async function firstSdcp(host) {
  const r = await discoverSdcp({ timeoutMs: 1200, hosts: [host] });
  return r.candidates[0] ?? null;
}

async function firstSnapmaker(host) {
  const r = await discoverSnapmaker({ timeoutMs: 1200, hosts: [host] });
  return r.candidates[0] ?? null;
}

/** Açık port → olası probelar. */
const PORT_PROBES = {
  8883: (h) => probeBambuTls(h),
  9999: (h) => probeCrealityWs(h, 9999),
  3030: (h) => firstSdcp(h),
  8899: (h) => probeFlashforgeTcp(h),
  7125: (h) => probeMoonraker(h, 7125),
  80: (h) => probeHttpPrinter(h, 80),
  5000: (h) => probeHttpPrinter(h, 5000),
  6000: (h) => probeAnycubicWs(h, 6000),
  8080: (h) => firstSnapmaker(h),
};

/** Tek host: bilinen portları yoklar, açık olanlarda marka parmak izi çalıştırır. */
export async function probeHost(host, { ports = SCAN_PORTS, openPorts, timeoutMs = 600 } = {}) {
  const open =
    openPorts ??
    (await Promise.all(ports.map(async (p) => ((await tcpOpen(host, p, timeoutMs)) ? p : null)))).filter(
      (p) => p != null
    );
  const results = await Promise.all(
    open.map((p) => (PORT_PROBES[p] ? PORT_PROBES[p](host).catch(() => null) : null))
  );
  // UDP-only yanıtlar (port kapalı görünse bile): SDCP ve Snapmaker unicast
  const extra = [];
  if (!open.includes(3030)) extra.push(firstSdcp(host).catch(() => null));
  if (!open.includes(8080)) extra.push(firstSnapmaker(host).catch(() => null));
  const more = openPorts ? [] : await Promise.all(extra);
  return { openPorts: open, candidates: [...results, ...more].filter(Boolean) };
}

/** Aday zenginleştirme: mDNS/UDP ile bulunan ama serisi eksik adaylar için doğrulama probu. */
export async function verifyCandidate(c) {
  try {
    switch (c.vendor) {
      case "bambu":
        return c.serial ? null : probeBambuTls(c.host);
      case "creality":
        return probeCrealityWs(c.host, c.lanPort || 9999);
      case "klipper":
        return probeMoonraker(c.host, c.lanPort || 7125);
      case "octoprint":
      case "prusalink":
        return probeHttpPrinter(c.host, c.lanPort || 80);
      case "flashforge":
        return probeFlashforgeTcp(c.host);
      case "elegoo":
        return c.serial ? null : firstSdcp(c.host);
      default:
        return null;
    }
  } catch {
    return null;
  }
}
