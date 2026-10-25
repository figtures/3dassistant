import dgram from "node:dgram";

/** Bambu Lab model kodları (DevModel.bambu.com) → okunur ad. Bilinmeyen kod olduğu gibi gösterilir. */
export const BAMBU_MODELS = {
  "BL-P001": "X1 Carbon",
  "BL-P002": "X1",
  C13: "X1E",
  C11: "P1P",
  C12: "P1S",
  N1: "A1 mini",
  N2S: "A1",
  O1D: "H2D",
  N6: "X2D",
};

export const BAMBU_SSDP_PORTS = [2021, 1990];

/** SSDP/HTTPU mesajı → { startLine, headers (küçük harf anahtar) }. */
export function parseSsdpMessage(text) {
  const lines = String(text).split(/\r?\n/);
  const startLine = (lines.shift() ?? "").trim();
  const headers = {};
  for (const line of lines) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (key && !(key in headers)) headers[key] = value;
  }
  return { startLine, headers };
}

function isBambuMessage(h) {
  const nt = `${h.nt ?? ""} ${h.st ?? ""}`.toLowerCase();
  return nt.includes("bambulab") || "devmodel.bambu.com" in h || "devname.bambu.com" in h;
}

/** Bambu NOTIFY / M-SEARCH yanıtı → keşif adayı (değilse null). */
export function bambuCandidateFromSsdp(text, senderIp) {
  const { headers: h } = parseSsdpMessage(text);
  if (!isBambuMessage(h)) return null;
  const location = (h.location ?? "").replace(/^https?:\/\//, "").replace(/[:/].*$/, "");
  const host = /^\d{1,3}(\.\d{1,3}){3}$/.test(location) ? location : senderIp;
  const serial = (h.usn ?? "").replace(/^uuid:/i, "").split("::")[0].trim();
  if (!host || !serial) return null;
  const modelCode = h["devmodel.bambu.com"] ?? null;
  const connect = (h["devconnect.bambu.com"] ?? "").toLowerCase();
  const bind = (h["devbind.bambu.com"] ?? "").toLowerCase();
  const signal = Number(h["devsignal.bambu.com"]);
  return {
    vendor: "bambu",
    host,
    serial,
    model: modelCode ? (BAMBU_MODELS[modelCode] ?? modelCode) : null,
    name: h["devname.bambu.com"] || null,
    methods: ["ssdp"],
    confidence: 0.95,
    extra: {
      modelCode,
      connectMode: connect || null,
      bind: bind || null,
      signalDbm: Number.isFinite(signal) ? signal : null,
      firmware: h["devversion.bambu.com"] || null,
    },
  };
}

const MSEARCH = [
  "M-SEARCH * HTTP/1.1",
  "HOST: 239.255.255.250:1990",
  'MAN: "ssdp:discover"',
  "MX: 2",
  "ST: urn:bambulab-com:device:3dprinter:1",
  "",
  "",
].join("\r\n");

function bindUdp(port) {
  return new Promise((resolve) => {
    const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
    sock.once("error", () => {
      sock.close();
      resolve(null);
    });
    sock.bind(port, () => {
      sock.removeAllListeners("error");
      sock.on("error", () => {});
      try {
        sock.setBroadcast(true);
      } catch {
        /* yok */
      }
      resolve(sock);
    });
  });
}

/**
 * Bambu yazıcıları ~5 sn'de bir UDP 2021'e SSDP NOTIFY yayınlar; ayrıca M-SEARCH ile tetiklenir.
 * Port meşgulse (Bambu Studio açık) yalnızca M-SEARCH yanıtları dinlenir.
 */
export async function discoverBambuSsdp({ timeoutMs = 6000, interfaces = [] } = {}) {
  const found = [];
  const errors = [];
  const sockets = [];
  for (const port of BAMBU_SSDP_PORTS) {
    const s = await bindUdp(port);
    if (s) sockets.push(s);
    else errors.push(`UDP ${port} dinlenemedi (Bambu Studio / OrcaSlicer açık olabilir)`);
  }
  const ephemeral = await bindUdp(0);
  if (ephemeral) sockets.push(ephemeral);

  const onMsg = (msg, rinfo) => {
    const c = bambuCandidateFromSsdp(msg.toString("utf8"), rinfo.address);
    if (c) found.push(c);
  };
  for (const s of sockets) s.on("message", onMsg);

  if (ephemeral) {
    const targets = ["239.255.255.250", "255.255.255.255", ...interfaces.map((i) => i.broadcast)];
    const send = () => {
      for (const t of new Set(targets)) {
        for (const port of BAMBU_SSDP_PORTS) {
          ephemeral.send(MSEARCH, port, t, () => {});
        }
      }
    };
    send();
    setTimeout(send, Math.min(1500, timeoutMs / 3));
  }

  await new Promise((r) => setTimeout(r, timeoutMs));
  for (const s of sockets) {
    try {
      s.close();
    } catch {
      /* kapalı */
    }
  }
  return { method: "ssdp", candidates: found, errors };
}
