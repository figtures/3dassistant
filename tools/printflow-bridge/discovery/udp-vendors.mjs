import dgram from "node:dgram";

export const SDCP_PORT = 3000;
export const SDCP_PROBE = "M99999";
export const SNAPMAKER_PORT = 20054;
export const FLASHFORGE_MULTICAST = "225.0.0.9";
export const FLASHFORGE_PORTS = [19000, 48899];

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Elegoo SDCP (Centauri Carbon, Saturn/Mars v3) `M99999` yanıtı. */
export function parseSdcpResponse(text, senderIp) {
  const j = safeJson(String(text).trim());
  if (!j || typeof j !== "object") return null;
  const d = j.Data?.Attributes ?? j.Data ?? j.Attributes ?? null;
  if (!d || typeof d !== "object") return null;
  const id = d.MainboardID ?? d.MainboardId ?? d.mainboardId;
  if (!id) return null;
  const host = d.MainboardIP && /^\d{1,3}(\.\d{1,3}){3}$/.test(d.MainboardIP) ? d.MainboardIP : senderIp;
  return {
    vendor: "elegoo",
    host,
    serial: String(id),
    model: d.MachineName || d.Name || null,
    name: d.Name || d.MachineName || null,
    lanPort: 3030,
    methods: ["sdcp"],
    confidence: 0.95,
    extra: {
      brand: d.BrandName ?? null,
      protocol: d.ProtocolVersion ?? null,
      firmware: d.FirmwareVersion ?? null,
    },
  };
}

/** Snapmaker `discover` yanıtı: `Snapmaker@IP|model:...|status:...|SACP:1`. */
export function parseSnapmakerResponse(text, senderIp) {
  const s = String(text).trim();
  if (!/snapmaker/i.test(s) || !s.includes("|")) return null;
  const [head, ...rest] = s.split("|");
  const at = head.indexOf("@");
  const name = at > 0 ? head.slice(0, at) : head;
  const ip = at > 0 ? head.slice(at + 1).trim() : "";
  const fields = {};
  for (const part of rest) {
    const i = part.indexOf(":");
    if (i > 0) fields[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return {
    vendor: "snapmaker",
    host: /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) ? ip : senderIp,
    serial: fields.sn || fields.serial || null,
    model: fields.model || null,
    name: name || null,
    methods: ["snapmaker-udp"],
    confidence: 0.9,
    extra: { status: fields.status ?? null, sacp: fields.sacp ?? null },
  };
}

function printableRuns(buf) {
  const runs = [];
  let cur = "";
  for (const b of buf) {
    if (b >= 0x20 && b < 0x7f) cur += String.fromCharCode(b);
    else {
      if (cur.trim().length >= 3) runs.push(cur.trim());
      cur = "";
    }
  }
  if (cur.trim().length >= 3) runs.push(cur.trim());
  return runs;
}

/** Flashforge UDP keşif yanıtı (ikili; sabit ofset yerine savunmacı metin çıkarımı). */
export function parseFlashforgeUdp(buf, senderIp) {
  if (!Buffer.isBuffer(buf) || buf.length < 8) return null;
  const runs = printableRuns(buf);
  if (!runs.length) return null;
  const serial = runs.find((r) => /^SN[A-Z0-9]{6,}$/i.test(r)) ?? null;
  const name = runs.find((r) => r !== serial) ?? null;
  return {
    vendor: "flashforge",
    host: senderIp,
    serial,
    model: null,
    name,
    lanPort: 8899,
    methods: ["flashforge-udp"],
    confidence: serial ? 0.85 : 0.6,
    extra: {},
  };
}

/** Flashforge TCP 8899 `~M115` yanıtı. */
export function parseFlashforgeM115(text) {
  const t = String(text);
  if (!/Machine Type|Machine Name|SN:/i.test(t)) return null;
  const pick = (re) => t.match(re)?.[1]?.trim() || null;
  return {
    machineType: pick(/Machine Type:\s*([^\r\n]+)/i),
    machineName: pick(/Machine Name:\s*([^\r\n]+)/i),
    firmware: pick(/Firmware:\s*([^\r\n]+)/i),
    serial: pick(/SN:\s*([^\s\r\n]+)/i),
    mac: pick(/Mac Address:\s*([0-9A-Fa-f:.-]{11,17})/i),
  };
}

async function openUdp() {
  const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
  const ok = await new Promise((resolve) => {
    sock.once("error", () => resolve(false));
    sock.bind(0, () => resolve(true));
  });
  if (!ok) {
    try {
      sock.close();
    } catch {
      /* */
    }
    return null;
  }
  sock.on("error", () => {});
  try {
    sock.setBroadcast(true);
  } catch {
    /* */
  }
  return sock;
}

/** Yayın/çoklu yayın sorgusu → yanıtları parse eder. */
export async function udpQuery({ payload, sends, timeoutMs, parse }) {
  const sock = await openUdp();
  if (!sock) return { candidates: [], error: "UDP soketi açılamadı" };
  const candidates = [];
  sock.on("message", (msg, rinfo) => {
    const c = parse(msg, rinfo.address);
    if (c) candidates.push(c);
  });
  const fire = () => {
    for (const [host, port] of sends) sock.send(payload, port, host, () => {});
  };
  fire();
  setTimeout(fire, Math.min(700, timeoutMs / 3));
  await new Promise((r) => setTimeout(r, timeoutMs));
  try {
    sock.close();
  } catch {
    /* */
  }
  return { candidates, error: null };
}

function broadcastTargets(interfaces) {
  return [...new Set(["255.255.255.255", ...interfaces.map((i) => i.broadcast).filter(Boolean)])];
}

export async function discoverSdcp({ timeoutMs = 2500, interfaces = [], hosts } = {}) {
  const targets = hosts ?? broadcastTargets(interfaces);
  const r = await udpQuery({
    payload: Buffer.from(SDCP_PROBE),
    sends: targets.map((h) => [h, SDCP_PORT]),
    timeoutMs,
    parse: (msg, ip) => parseSdcpResponse(msg.toString("utf8"), ip),
  });
  return { method: "sdcp", candidates: r.candidates, errors: r.error ? [r.error] : [] };
}

export async function discoverSnapmaker({ timeoutMs = 2500, interfaces = [], hosts } = {}) {
  const targets = hosts ?? broadcastTargets(interfaces);
  const r = await udpQuery({
    payload: Buffer.from("discover"),
    sends: targets.map((h) => [h, SNAPMAKER_PORT]),
    timeoutMs,
    parse: (msg, ip) => parseSnapmakerResponse(msg.toString("utf8"), ip),
  });
  return { method: "snapmaker-udp", candidates: r.candidates, errors: r.error ? [r.error] : [] };
}

export async function discoverFlashforge({ timeoutMs = 2500, interfaces = [] } = {}) {
  const sends = [];
  for (const port of FLASHFORGE_PORTS) {
    sends.push([FLASHFORGE_MULTICAST, port]);
    for (const b of broadcastTargets(interfaces)) sends.push([b, port]);
  }
  const r = await udpQuery({
    payload: Buffer.alloc(20),
    sends,
    timeoutMs,
    parse: (msg, ip) => parseFlashforgeUdp(msg, ip),
  });
  return { method: "flashforge-udp", candidates: r.candidates, errors: r.error ? [r.error] : [] };
}
