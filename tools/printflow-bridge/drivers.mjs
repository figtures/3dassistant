import mqtt from "mqtt";
import WebSocket from "ws";
import https from "node:https";
import http from "node:http";
import tls from "node:tls";
import {
  klipperCameraUrls,
  pollElegooSdcp,
  pollFlashforgeTcp,
  pollKlipper,
  pollOctoPrint,
  pollPrusaLink,
} from "./vendor-drivers.mjs";

const VENDOR_HTTP = {
  creality: { httpPort: 80, paths: ["/api/print/snapshot", "/cgi-bin/get_dev_state"], wsPort: 9999 },
  anycubic: { httpPort: 8080, paths: ["/api/printer/status", "/api/v1/printer/status"], wsPort: 6000 },
  elegoo: { httpPort: 80, paths: ["/status", "/api/status", "/printer/status"], wsPort: 0 },
  flashforge: { httpPort: 8899, paths: ["/api/detail", "/api/status"], wsPort: 0 },
  snapmaker: { httpPort: 8080, https: true, paths: ["/api/v1/status", "/api/status"], wsPort: 0 },
};

/** Vendor LAN kamera snapshot / MJPEG tek kare URL’leri (sırayla denenir). */
function cameraCandidateUrls(printer) {
  const host = printer.host;
  const vendor = printer.vendor?.toLowerCase();
  const profile = VENDOR_HTTP[vendor] ?? { httpPort: 80, https: false };
  const port = printer.lanPort > 0 ? printer.lanPort : profile.httpPort;
  const scheme = profile.https ? "https" : "http";
  const urls = [];

  const push = (u) => {
    if (u && !urls.includes(u)) urls.push(u);
  };

  if (printer.cameraStreamUrl) {
    push(String(printer.cameraStreamUrl).replace("action=stream", "action=snapshot"));
  }
  const envCam = process.env.PRINTER_CAMERA_URL;
  if (envCam) push(envCam);

  switch (vendor) {
    case "bambu":
      push(`http://${host}:8080/?action=snapshot`);
      push(`http://${host}:8080/?action=get_key_frame`);
      break;
    case "creality":
      push(`http://${host}:8080/?action=snapshot`);
      push(`http://${host}/webcam/?action=snapshot`);
      push(`http://${host}/api/camera/preview`);
      break;
    case "anycubic":
      push(`http://${host}:${port}/webcam/?action=snapshot`);
      push(`http://${host}:${port}/snap`);
      push(`http://${host}:8080/webcam/?action=snapshot`);
      break;
    case "elegoo":
      push(`http://${host}:${port}/snap`);
      push(`http://${host}:${port}/api/camera/snapshot`);
      push(`http://${host}/webcam/?action=snapshot`);
      break;
    case "flashforge":
      push(`http://${host}:8899/snapshot`);
      push(`http://${host}:8899/api/snapshot`);
      push(`http://${host}:${port}/snapshot`);
      break;
    case "snapmaker":
      push(`${scheme}://${host}:${port}/api/v1/webcam/?action=snapshot`);
      push(`https://${host}:8080/webcam/?action=snapshot`);
      break;
    case "octoprint":
      push(`http://${host}${printer.lanPort > 0 && printer.lanPort !== 80 ? `:${printer.lanPort}` : ""}/webcam/?action=snapshot`);
      push(`http://${host}:8080/?action=snapshot`);
      break;
    case "prusalink":
      break;
    default:
      push(`http://${host}:${port}/?action=snapshot`);
      push(`http://${host}:${port}/webcam/?action=snapshot`);
  }
  return urls;
}

function looksLikeJpeg(buf) {
  return buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8;
}

function looksLikePng(buf) {
  return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50;
}

function parseImagePayload(buf, contentType) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("image/") || looksLikeJpeg(buf) || looksLikePng(buf)) {
    const mime = looksLikePng(buf) ? "image/png" : "image/jpeg";
    return { buffer: buf, contentType: ct.includes("image/") ? ct.split(";")[0].trim() : mime };
  }
  if (ct.includes("json") || (buf.length && buf[0] === 0x7b)) {
    try {
      const j = JSON.parse(buf.toString("utf8"));
      const b64 =
        j.image ?? j.img ?? j.snapshot ?? j.data ?? j.pic ?? j.Picture ?? j.picture;
      if (typeof b64 === "string") {
        const raw = b64.includes(",") ? b64.split(",").pop() : b64;
        const image = Buffer.from(raw.trim(), "base64");
        if (image.length > 64) {
          return { buffer: image, contentType: "image/jpeg" };
        }
      }
    } catch {
      /* not json image */
    }
  }
  return null;
}

function httpBinaryGet(url, insecureTls) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const opts = insecureTls && url.startsWith("https") ? { rejectUnauthorized: false } : {};
    const req = lib.get(url, opts, (res) => {
      if (res.statusCode && res.statusCode >= 300) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        const parsed = parseImagePayload(buf, res.headers["content-type"] || "");
        if (parsed) resolve(parsed);
        else reject(new Error("görüntü değil"));
      });
    });
    req.on("error", reject);
    req.setTimeout(10_000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

/** LAN’dan tek JPEG/PNG karesi çeker (köprü → bulut push). */
export async function fetchCameraFrame(printer) {
  const vendor = printer.vendor?.toLowerCase();
  const profile = VENDOR_HTTP[vendor] ?? { https: false };
  const insecure = Boolean(profile.https || printer.bambuTlsInsecure);
  const urls =
    vendor === "klipper"
      ? [
          ...[printer.cameraStreamUrl?.replace("action=stream", "action=snapshot"), process.env.PRINTER_CAMERA_URL].filter(Boolean),
          ...(await klipperCameraUrls(printer)),
        ]
      : cameraCandidateUrls(printer);
  for (const url of urls) {
    try {
      const frame = await httpBinaryGet(url, insecure);
      if (frame.buffer.length > 64 && frame.buffer.length < 2 * 1024 * 1024) {
        return frame;
      }
    } catch {
      /* next url */
    }
  }
  return null;
}

function mapState(state) {
  const s = String(state ?? "").toLowerCase();
  if (s.includes("print") || s === "1" || s === "running") return "printing";
  if (s.includes("pause") || s === "4") return "paused";
  if (s.includes("error") || s.includes("fail")) return "error";
  if (s.includes("offline")) return "offline";
  return "idle";
}

function extractTemps(raw) {
  const bed =
    raw.bed_temper ?? raw.bed_temp ?? raw.bedTemp ?? raw.bedTemp0 ?? raw.BedTemp ?? raw.bed_temperature;
  const nozzle =
    raw.nozzle_temper ?? raw.nozzle_temp ?? raw.nozzleTemp ?? raw.NozzleTemp ?? raw.extruder_temp;
  const chamber = raw.chamber_temper ?? raw.chamber_temp ?? raw.chamberTemp ?? raw.boxTemp;
  const num = (v) => (v != null && !Number.isNaN(Number(v)) ? Number(v) : null);
  return {
    bedTempC: num(bed),
    nozzleTempC: num(nozzle),
    chamberTempC: num(chamber),
  };
}

function telemetryFromRaw(vendor, deviceId, raw, online = true) {
  const state = mapState(
    raw.status ?? raw.Status ?? raw.state ?? raw.State ?? raw.currentStatus ?? raw.CurrentStatus
  );
  let progress =
    raw.progress ?? raw.printProgress ?? raw.PrintProgress ?? raw.percent ?? raw.dProgress;
  if (progress != null) progress = Number(progress);
  const job = raw.jobName ?? raw.gcodeName ?? raw.GcodeName ?? raw.fileName ?? null;
  const active = state === "printing" || state === "paused";
  const temps = extractTemps(raw);
  return {
    connectionStatus: state === "offline" ? "disconnected" : state === "error" ? "error" : "connected",
    printerState: online ? state : "offline",
    jobName: active && job ? String(job) : null,
    progressPercent: active && progress != null && !Number.isNaN(progress) ? progress : null,
    printTimeSeconds: null,
    errorMessage: state === "error" ? "Yazıcı hata durumu" : null,
    bedTempC: temps.bedTempC,
    nozzleTempC: temps.nozzleTempC,
    chamberTempC: temps.chamberTempC,
    cameraStreamUrl: null,
    raw: { vendor, deviceId, lan: raw },
  };
}

async function pollHttp(host, profile, lanPort) {
  const port = lanPort > 0 ? lanPort : profile.httpPort;
  const scheme = profile.https ? "https" : "http";
  for (const path of profile.paths) {
    try {
      const url = `${scheme}://${host}:${port}${path}`;
      const body = await httpJsonGet(url, profile.https);
      if (body?.Status && typeof body.Status === "object") return body.Status;
      return body;
    } catch {
      /* try next */
    }
  }
  return null;
}

function httpJsonGet(url, insecureTls) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const opts = insecureTls && url.startsWith("https") ? { rejectUnauthorized: false } : {};
    const req = lib.get(url, opts, (res) => {
      if (res.statusCode && res.statusCode >= 300) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = "";
      res.on("data", (c) => {
        data += c;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

function pollWs(host, wsPort) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${host}:${wsPort}/`);
    const t = setTimeout(() => {
      ws.terminate();
      reject(new Error("ws timeout"));
    }, 6000);
    ws.on("open", () => {
      ws.send(JSON.stringify({ mode: "subscribe", topic: "print" }));
      ws.send(JSON.stringify({ mode: "subscribe", topic: "status" }));
    });
    ws.on("message", (data) => {
      clearTimeout(t);
      try {
        const j = JSON.parse(data.toString());
        resolve(j.Status && typeof j.Status === "object" ? j.Status : j);
      } catch {
        resolve({ raw: data.toString() });
      }
      ws.close();
    });
    ws.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

export async function pollVendorLan(printer) {
  const vendor = printer.vendor?.toLowerCase();
  const profile = VENDOR_HTTP[vendor] ?? { httpPort: 80, paths: ["/api/status"], wsPort: 0 };
  const lanPort = printer.lanPort ?? 0;
  if (profile.wsPort || (vendor === "creality" && lanPort)) {
    const wp = lanPort > 0 && vendor !== "creality" ? lanPort : profile.wsPort || lanPort || 9999;
    try {
      const raw = await pollWs(printer.host, wp);
      return telemetryFromRaw(vendor, printer.serial, raw, true);
    } catch {
      /* http fallback */
    }
  }
  const raw = await pollHttp(printer.host, profile, lanPort);
  if (!raw) throw new Error(`${vendor} LAN yanıt vermedi`);
  return telemetryFromRaw(vendor, printer.serial, raw, true);
}

/** Bambu 8883 sertifikası: SHA-256 parmak izi + CN (CN = yazıcı seri numarası). */
export function bambuCertInfo(host, { timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const sock = tls.connect({ host, port: 8883, rejectUnauthorized: false });
    const done = (err, v) => {
      sock.removeAllListeners();
      sock.destroy();
      if (err) reject(err);
      else resolve(v);
    };
    sock.setTimeout(timeoutMs, () => done(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })));
    sock.once("error", (e) => done(e));
    sock.once("secureConnect", () => {
      const cert = sock.getPeerCertificate();
      done(null, { sha256: cert?.fingerprint256 ?? null, cn: cert?.subject?.CN ?? null });
    });
  });
}

/** MQTT/TLS hatalarını kullanıcıya anlamlı Türkçe mesaja çevirir. */
export function bambuErrorMessage(err) {
  const msg = String(err?.message ?? err);
  const code = err?.code;
  if (/not authori[sz]ed|bad user ?name or password|connack.*\b(4|5)\b/i.test(msg) || code === 4 || code === 5) {
    return "Bambu erişim kodu hatalı (yazıcı ekranı → Ayarlar → WLAN/LAN Only → Access Code; kod yenilendiyse güncelleyin)";
  }
  if (code === "ECONNREFUSED" || /ECONNREFUSED/.test(msg)) {
    return "Bambu 8883 bağlantıyı reddetti: LAN Only modu (yeni firmware'de Developer Mode) kapalı olabilir";
  }
  if (code === "ETIMEDOUT" || code === "EHOSTUNREACH" || /timeout|EHOSTUNREACH|ENETUNREACH/i.test(msg)) {
    return "Bambu yazıcı yanıt vermiyor (kapalı veya IP değişmiş olabilir)";
  }
  if (/sertifika/i.test(msg)) return msg;
  return `Bambu MQTT: ${msg}`;
}

/**
 * Bambu yazıcılar kendi CA'larıyla imzalı sertifika kullanır (sistem güven deposunda yok).
 * İlk bağlantıda parmak izi kaydedilir (TOFU), sonrakilerde eşleşmezse bağlanılmaz —
 * erişim kodu araya giren bir cihaza gönderilmez.
 */
async function verifyBambuTls(printer) {
  if (printer.bambuTlsInsecure) return;
  let info;
  try {
    info = await bambuCertInfo(printer.host);
  } catch (e) {
    throw new Error(bambuErrorMessage(e));
  }
  if (info.cn && /^[0-9A-Z]{8,20}$/.test(info.cn) && printer.serial && info.cn !== printer.serial) {
    throw new Error(`Bu IP'deki Bambu yazıcı farklı (${info.cn}); IP değişmiş olabilir`);
  }
  if (printer.bambuCertSha256 && info.sha256 && printer.bambuCertSha256 !== info.sha256) {
    throw new Error("Bambu TLS sertifikası değişti — ağda araya giren cihaz olabilir; yazıcıyı yeniden eşleştirin");
  }
  if (!printer.bambuCertSha256 && info.sha256) {
    printer.bambuCertSha256 = info.sha256;
    printer._configDirty = true;
  }
}

export async function pollBambuMqtt(printer) {
  await verifyBambuTls(printer);
  return new Promise((resolve, reject) => {
    const host = printer.host;
    const serial = printer.serial;
    const accessCode = printer.accessCode;
    const tlsServerName = printer.bambuTlsServerName || serial;
    const topic = `device/${serial}/report`;
    const client = mqtt.connect(`mqtts://${host}:8883`, {
      username: "bblp",
      password: accessCode,
      connectTimeout: 12_000,
      reconnectPeriod: 0,
      rejectUnauthorized: false,
      servername: tlsServerName,
      clientId: `printflow-bridge-node-${Date.now()}`,
    });
    let finished = false;
    const done = (err, tel) => {
      if (finished) return;
      finished = true;
      client.end(true);
      if (err) reject(new Error(bambuErrorMessage(err)));
      else resolve(tel);
    };
    client.on("error", (e) => done(e));
    client.on("connect", () => {
      client.subscribe(topic, () => {
        // P1/A1 serisi boşta yalnızca değişiklik yayınlar; tam rapor iste.
        client.publish(
          `device/${serial}/request`,
          JSON.stringify({ pushing: { sequence_id: String(Date.now()), command: "pushall" } })
        );
      });
    });
    client.on("message", (_t, payload) => {
      let doc;
      try {
        doc = JSON.parse(payload.toString());
      } catch {
        return done(new Error("mqtt json"));
      }
      const print = doc.print && typeof doc.print === "object" ? doc.print : doc;
      const state = String(
        print.gcode_state ?? print.mc_print_stage ?? doc.gcode_state ?? ""
      ).toLowerCase();
      let printerState = "idle";
      if (state.includes("print") || state === "running") printerState = "printing";
      else if (state.includes("pause")) printerState = "paused";
      else if (state.includes("error") || state.includes("fail")) printerState = "error";
      const progress = print.mc_percent ?? doc.mc_percent;
      const job = print.subtask_name ?? doc.subtask_name ?? null;
      const active = printerState === "printing" || printerState === "paused";
      const temps = extractTemps({ ...doc, ...print });
      const cameraStreamUrl =
        printer.cameraStreamUrl ||
        process.env.PRINTER_CAMERA_URL ||
        (printer.host ? `http://${printer.host}:8080/?action=stream` : null);
      done(null, {
        connectionStatus: "connected",
        printerState,
        jobName: active && job ? String(job) : null,
        progressPercent: active && progress != null ? Number(progress) : null,
        printTimeSeconds: null,
        errorMessage: null,
        bedTempC: temps.bedTempC,
        nozzleTempC: temps.nozzleTempC,
        chamberTempC: temps.chamberTempC,
        cameraStreamUrl,
        raw: { vendor: "bambu", serial, report: doc },
      });
    });
    const timer = setTimeout(() => done(new Error("mqtt timeout")), 14_000);
    client.once("close", () => {
      if (finished) clearTimeout(timer);
    });
  });
}

export async function pollPrinter(printer) {
  switch (printer.vendor) {
    case "bambu":
      return pollBambuMqtt(printer);
    case "klipper":
      return pollKlipper(printer);
    case "octoprint":
      return pollOctoPrint(printer);
    case "prusalink":
      return pollPrusaLink(printer);
    case "elegoo":
      try {
        return await pollElegooSdcp(printer);
      } catch {
        return pollVendorLan(printer);
      }
    case "flashforge":
      try {
        return await pollVendorLan(printer);
      } catch {
        return pollFlashforgeTcp(printer);
      }
    default:
      return pollVendorLan(printer);
  }
}
