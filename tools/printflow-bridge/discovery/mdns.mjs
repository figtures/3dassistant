import dgram from "node:dgram";

export const MDNS_ADDR = "224.0.0.251";
export const MDNS_PORT = 5353;

export const TYPE = { A: 1, PTR: 12, TXT: 16, AAAA: 28, SRV: 33, ANY: 255 };

/** Varsayılan sorgular: DNS-SD meta + 3D yazıcı ekosistemlerinin bilinen servis tipleri. */
export const DEFAULT_SERVICE_QUERIES = [
  "_services._dns-sd._udp.local",
  "_moonraker._tcp.local",
  "_octoprint._tcp.local",
  "_prusa-link._tcp.local",
  "_http._tcp.local",
  "_ultimaker._tcp.local",
  "_formlabs_formule._tcp.local",
];

function encodeName(name) {
  const parts = name.replace(/\.$/, "").split(".");
  const bufs = [];
  for (const p of parts) {
    const b = Buffer.from(p, "utf8");
    if (b.length > 63) throw new Error(`mDNS etiket çok uzun: ${p}`);
    bufs.push(Buffer.from([b.length]), b);
  }
  bufs.push(Buffer.from([0]));
  return Buffer.concat(bufs);
}

/** Sorgu paketi. `unicastResponse` = QU biti (yanıt doğrudan bize gelsin). */
export function encodeMdnsQuery(questions, { id = 0, unicastResponse = true } = {}) {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(id, 0);
  header.writeUInt16BE(0, 2);
  header.writeUInt16BE(questions.length, 4);
  const qs = questions.map((q) => {
    const { name, type = TYPE.PTR } = typeof q === "string" ? { name: q } : q;
    const tail = Buffer.alloc(4);
    tail.writeUInt16BE(type, 0);
    tail.writeUInt16BE(0x0001 | (unicastResponse ? 0x8000 : 0), 2);
    return Buffer.concat([encodeName(name), tail]);
  });
  return Buffer.concat([header, ...qs]);
}

function readName(buf, offset) {
  const labels = [];
  let pos = offset;
  let jumped = false;
  let end = offset;
  for (let guard = 0; guard < 128; guard++) {
    if (pos >= buf.length) throw new Error("mDNS ad taşması");
    const len = buf[pos];
    if (len === 0) {
      if (!jumped) end = pos + 1;
      return { name: labels.join("."), end };
    }
    if ((len & 0xc0) === 0xc0) {
      if (pos + 1 >= buf.length) throw new Error("mDNS işaretçi taşması");
      const ptr = ((len & 0x3f) << 8) | buf[pos + 1];
      if (!jumped) end = pos + 2;
      jumped = true;
      if (ptr >= buf.length) throw new Error("mDNS geçersiz işaretçi");
      pos = ptr;
      continue;
    }
    if (pos + 1 + len > buf.length) throw new Error("mDNS etiket taşması");
    labels.push(buf.toString("utf8", pos + 1, pos + 1 + len));
    pos += 1 + len;
  }
  throw new Error("mDNS işaretçi döngüsü");
}

function parseTxt(buf, start, end) {
  const out = {};
  let p = start;
  while (p < end) {
    const len = buf[p];
    const s = buf.toString("utf8", p + 1, Math.min(end, p + 1 + len));
    p += 1 + len;
    if (!s) continue;
    const i = s.indexOf("=");
    if (i < 0) out[s.toLowerCase()] = true;
    else out[s.slice(0, i).toLowerCase()] = s.slice(i + 1);
  }
  return out;
}

/** mDNS / DNS yanıt paketi → kayıtlar (bozuk paket hata fırlatır). */
export function decodeMdnsPacket(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) throw new Error("mDNS paket kısa");
  const id = buf.readUInt16BE(0);
  const flags = buf.readUInt16BE(2);
  const qd = buf.readUInt16BE(4);
  const counts = [buf.readUInt16BE(6), buf.readUInt16BE(8), buf.readUInt16BE(10)];
  let off = 12;
  const questions = [];
  for (let i = 0; i < qd; i++) {
    const { name, end } = readName(buf, off);
    questions.push({ name, type: buf.readUInt16BE(end) });
    off = end + 4;
  }
  const records = [];
  const total = counts[0] + counts[1] + counts[2];
  for (let i = 0; i < total; i++) {
    const { name, end } = readName(buf, off);
    if (end + 10 > buf.length) throw new Error("mDNS kayıt taşması");
    const type = buf.readUInt16BE(end);
    const ttl = buf.readUInt32BE(end + 4);
    const rdlen = buf.readUInt16BE(end + 8);
    const rstart = end + 10;
    const rend = rstart + rdlen;
    if (rend > buf.length) throw new Error("mDNS rdata taşması");
    let data = null;
    if (type === TYPE.PTR) data = readName(buf, rstart).name;
    else if (type === TYPE.A && rdlen === 4) data = [...buf.subarray(rstart, rend)].join(".");
    else if (type === TYPE.SRV && rdlen >= 7) {
      data = {
        priority: buf.readUInt16BE(rstart),
        weight: buf.readUInt16BE(rstart + 2),
        port: buf.readUInt16BE(rstart + 4),
        target: readName(buf, rstart + 6).name,
      };
    } else if (type === TYPE.TXT) data = parseTxt(buf, rstart, rend);
    records.push({ name, type, ttl, data, section: i < counts[0] ? "answer" : "additional" });
    off = rend;
  }
  return { id, isResponse: (flags & 0x8000) !== 0, questions, records };
}

/** Yanıt kaydı (DNS cevabı oluşturma — test ve yerel simülasyon için). */
export function encodeMdnsResponse(records, { id = 0 } = {}) {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(id, 0);
  header.writeUInt16BE(0x8400, 2);
  header.writeUInt16BE(records.length, 6);
  const body = records.map((r) => {
    let rdata;
    if (r.type === TYPE.PTR) rdata = encodeName(r.data);
    else if (r.type === TYPE.A) rdata = Buffer.from(r.data.split(".").map(Number));
    else if (r.type === TYPE.SRV) {
      const h = Buffer.alloc(6);
      h.writeUInt16BE(r.data.priority ?? 0, 0);
      h.writeUInt16BE(r.data.weight ?? 0, 2);
      h.writeUInt16BE(r.data.port, 4);
      rdata = Buffer.concat([h, encodeName(r.data.target)]);
    } else if (r.type === TYPE.TXT) {
      rdata = Buffer.concat(
        Object.entries(r.data).map(([k, v]) => {
          const s = Buffer.from(v === true ? k : `${k}=${v}`);
          return Buffer.concat([Buffer.from([s.length]), s]);
        })
      );
    } else rdata = Buffer.alloc(0);
    const meta = Buffer.alloc(10);
    meta.writeUInt16BE(r.type, 0);
    meta.writeUInt16BE(1, 2);
    meta.writeUInt32BE(r.ttl ?? 120, 4);
    meta.writeUInt16BE(rdata.length, 8);
    return Buffer.concat([encodeName(r.name), meta, rdata]);
  });
  return Buffer.concat([header, ...body]);
}

const VENDOR_PATTERNS = [
  ["bambu", /bambu|bbl/i],
  ["creality", /creality|\bk1\b|k1c|k1max|\bk2\b|ender-?3 ?v3/i],
  ["elegoo", /elegoo|centauri/i],
  ["anycubic", /anycubic|kobra/i],
  ["flashforge", /flashforge|adventurer|creator ?\d/i],
  ["snapmaker", /snapmaker/i],
  ["prusalink", /prusa/i],
  ["octoprint", /octoprint/i],
  ["klipper", /moonraker|klipper|mainsail|fluidd/i],
  ["ultimaker", /ultimaker/i],
  ["formlabs", /formlabs|formule/i],
];

export function vendorHintFromText(text) {
  for (const [vendor, re] of VENDOR_PATTERNS) if (re.test(text)) return vendor;
  return null;
}

/** Creality OS servis adı cihaz kimliğini taşır: `_Creality-2657712810F9A7._udp.local`. */
export function crealityIdFromService(name) {
  return String(name).match(/_creality-([0-9a-z]{6,32})\._(?:udp|tcp)/i)?.[1]?.toUpperCase() ?? null;
}

function instanceLabel(fullName, serviceType) {
  return fullName.endsWith(`.${serviceType}`) ? fullName.slice(0, -serviceType.length - 1) : fullName;
}

/**
 * Bir yanıtlayıcının (IP) mDNS kayıtları → aday listesi.
 * Moonraker/OctoPrint/PrusaLink tip bazında; diğerleri ad/tip metninde marka araması ile.
 */
export function candidatesFromMdnsRecords(records, senderIp) {
  const ptrs = records.filter((r) => r.type === TYPE.PTR);
  const srv = new Map(records.filter((r) => r.type === TYPE.SRV).map((r) => [r.name, r.data]));
  const txt = new Map(records.filter((r) => r.type === TYPE.TXT).map((r) => [r.name, r.data]));
  const aRec = new Map(records.filter((r) => r.type === TYPE.A).map((r) => [r.name, r.data]));
  const out = [];
  const serviceTypes = [];
  for (const p of ptrs) {
    if (p.name === "_services._dns-sd._udp.local") {
      serviceTypes.push(p.data);
      const vendor = vendorHintFromText(p.data);
      if (vendor) {
        out.push({
          vendor,
          host: senderIp,
          serial: vendor === "creality" ? crealityIdFromService(p.data) : null,
          model: null,
          name: null,
          methods: ["mdns"],
          confidence: 0.5,
          extra: { mdnsService: p.data },
        });
      }
      continue;
    }
    const type = p.name;
    const instance = p.data;
    const label = instanceLabel(instance, type);
    const s = srv.get(instance);
    const t = txt.get(instance) ?? {};
    const host = (s && aRec.get(s.target)) || senderIp;
    let vendor = null;
    let typed = true;
    if (type.startsWith("_moonraker._tcp")) vendor = "klipper";
    else if (type.startsWith("_octoprint._tcp")) vendor = "octoprint";
    else if (type.startsWith("_prusa-link._tcp")) vendor = "prusalink";
    else if (type.startsWith("_ultimaker._tcp")) vendor = "ultimaker";
    else if (type.startsWith("_formlabs")) vendor = "formlabs";
    else {
      typed = false;
      vendor = vendorHintFromText(`${label} ${type} ${Object.values(t).join(" ")}`);
    }
    if (!vendor) continue;
    out.push({
      vendor,
      host,
      serial: t.serial || t.sn || t.uuid || (vendor === "creality" ? crealityIdFromService(type) : null),
      model: t.model || t.printer_type || null,
      name: label || null,
      // Marka ipucu servisleri (ör. _Creality-…._udp) cihazın API portunu taşımaz.
      lanPort: typed || type.startsWith("_http._tcp") ? (s?.port ?? null) : null,
      methods: ["mdns"],
      confidence: type.startsWith("_http._tcp") ? 0.5 : 0.7,
      extra: { mdnsService: type, mdnsInstance: instance, txt: t },
    });
  }
  return { candidates: out, serviceTypes };
}

/**
 * Her arayüzden 224.0.0.251:5353'e sorgu; geçici porttan gönderildiği için yanıtlayıcılar
 * RFC 6762 §6.7 gereği doğrudan bize (unicast) yanıt verir — 5353'ü bağlamaya gerek yok.
 */
export async function discoverMdns({ timeoutMs = 3500, interfaces = [], queries = DEFAULT_SERVICE_QUERIES } = {}) {
  const errors = [];
  const byHost = new Map();
  const learnedTypes = new Set();
  const sockets = [];
  const ifaceAddrs = interfaces.length ? interfaces.map((i) => i.address) : [undefined];

  for (const addr of ifaceAddrs) {
    const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
    const ok = await new Promise((resolve) => {
      sock.once("error", () => resolve(false));
      sock.bind({ port: 0, address: addr }, () => resolve(true));
    });
    if (!ok) {
      errors.push(`mDNS soketi açılamadı (${addr ?? "varsayılan"})`);
      try {
        sock.close();
      } catch {
        /* */
      }
      continue;
    }
    sock.on("error", () => {});
    try {
      if (addr) sock.setMulticastInterface(addr);
      sock.setMulticastTTL(255);
    } catch {
      /* bazı platformlarda yok */
    }
    sock.on("message", (msg, rinfo) => {
      try {
        const pkt = decodeMdnsPacket(msg);
        if (!pkt.isResponse) return;
        const list = byHost.get(rinfo.address) ?? [];
        list.push(...pkt.records);
        byHost.set(rinfo.address, list);
        for (const r of pkt.records) {
          if (r.type === TYPE.PTR && r.name === "_services._dns-sd._udp.local") learnedTypes.add(r.data);
        }
      } catch {
        /* bozuk paket — yok say */
      }
    });
    sockets.push(sock);
  }

  const send = (qs) => {
    const pkt = encodeMdnsQuery(qs, { id: Math.floor(Math.random() * 0xffff) });
    for (const s of sockets) s.send(pkt, MDNS_PORT, MDNS_ADDR, () => {});
  };
  if (!sockets.length) return { method: "mdns", candidates: [], errors };

  send(queries);
  await new Promise((r) => setTimeout(r, Math.floor(timeoutMs / 3)));
  const followUp = [...learnedTypes].filter((t) => vendorHintFromText(t) && !queries.includes(t));
  if (followUp.length) send(followUp.slice(0, 20));
  send(queries);
  await new Promise((r) => setTimeout(r, timeoutMs - Math.floor(timeoutMs / 3)));
  for (const s of sockets) {
    try {
      s.close();
    } catch {
      /* */
    }
  }

  const candidates = [];
  for (const [host, records] of byHost) {
    candidates.push(...candidatesFromMdnsRecords(records, host).candidates);
  }
  return { method: "mdns", candidates, errors };
}
