import http from "node:http";
import net from "node:net";
import { createHash, randomBytes } from "node:crypto";
import WebSocket from "ws";

const num = (v) => (v != null && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);

function baseTelemetry(vendor, serial, { state, job, progress, printTime, bed, nozzle, chamber, camera, raw, error }) {
  const active = state === "printing" || state === "paused";
  return {
    connectionStatus: state === "error" ? "error" : "connected",
    printerState: state,
    jobName: active && job ? String(job) : null,
    progressPercent: active && progress != null ? Math.round(progress * 10) / 10 : null,
    printTimeSeconds: active && printTime != null ? Math.floor(printTime) : null,
    errorMessage: state === "error" ? (error ?? "Yazıcı hata durumu") : null,
    bedTempC: num(bed),
    nozzleTempC: num(nozzle),
    chamberTempC: num(chamber),
    cameraStreamUrl: camera ?? null,
    raw: { vendor, deviceId: serial, lan: raw },
  };
}

/** Basit HTTP isteği (JSON gövde + başlıklar). */
export function request(method, host, port, path, { headers = {}, body, timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
    const req = http.request(
      {
        host,
        port,
        path,
        method,
        headers: {
          ...(data ? { "Content-Type": "application/json", "Content-Length": data.length } : {}),
          ...headers,
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            /* */
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, text, json });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("zaman aşımı")));
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// ---------------------------------------------------------------- Klipper / Moonraker

export async function pollKlipper(printer) {
  const port = printer.lanPort > 0 ? printer.lanPort : 7125;
  const headers = printer.apiKey ? { "X-Api-Key": printer.apiKey } : {};
  const res = await request(
    "GET",
    printer.host,
    port,
    "/printer/objects/query?print_stats&virtual_sdcard&display_status&extruder&heater_bed",
    { headers }
  );
  if (res.status === 401 || res.status === 403) {
    throw new Error("Moonraker yetki istiyor: API anahtarı girin veya trusted_clients ayarına bu bilgisayarı ekleyin");
  }
  if (res.status >= 300 || !res.json?.result?.status) throw new Error(`Moonraker HTTP ${res.status}`);
  return klipperTelemetry(printer.serial, res.json.result.status);
}

export function klipperTelemetry(serial, s) {
  const ps = s.print_stats ?? {};
  const st = String(ps.state ?? "").toLowerCase();
  const state = st === "printing" ? "printing" : st === "paused" ? "paused" : st === "error" ? "error" : "idle";
  const frac = num(s.display_status?.progress) ?? num(s.virtual_sdcard?.progress);
  return baseTelemetry("klipper", serial, {
    state,
    job: ps.filename || null,
    progress: frac != null ? frac * 100 : null,
    printTime: num(ps.print_duration),
    bed: s.heater_bed?.temperature,
    nozzle: s.extruder?.temperature,
    error: ps.message || null,
    raw: s,
  });
}

export async function klipperCameraUrls(printer) {
  const port = printer.lanPort > 0 ? printer.lanPort : 7125;
  const urls = [];
  try {
    const res = await request("GET", printer.host, port, "/server/webcams/list", {
      headers: printer.apiKey ? { "X-Api-Key": printer.apiKey } : {},
      timeoutMs: 3000,
    });
    for (const w of res.json?.result?.webcams ?? []) {
      const u = w.snapshot_url;
      if (!u) continue;
      urls.push(/^https?:/.test(u) ? u : `http://${printer.host}${u.startsWith("/") ? "" : "/"}${u}`);
    }
  } catch {
    /* webcam listesi yok */
  }
  urls.push(`http://${printer.host}/webcam/?action=snapshot`, `http://${printer.host}:4408/webcam/?action=snapshot`);
  return urls;
}

// ---------------------------------------------------------------- OctoPrint

export async function pollOctoPrint(printer) {
  const port = printer.lanPort > 0 ? printer.lanPort : 80;
  const headers = { "X-Api-Key": printer.apiKey ?? "" };
  const job = await request("GET", printer.host, port, "/api/job", { headers });
  if (job.status === 401 || job.status === 403) {
    throw new Error("OctoPrint API anahtarı geçersiz — köprüyü yeniden eşleştirip erişim isteğini onaylayın");
  }
  if (job.status >= 300 || !job.json) throw new Error(`OctoPrint HTTP ${job.status}`);
  const printerRes = await request("GET", printer.host, port, "/api/printer", { headers }).catch(() => null);
  return octoPrintTelemetry(printer.serial, job.json, printerRes?.status === 200 ? printerRes.json : null);
}

export function octoPrintTelemetry(serial, job, printerDoc) {
  const text = String(job.state ?? "").toLowerCase();
  let state = "idle";
  if (text.includes("pausing") || text.includes("paused")) state = "paused";
  else if (text.includes("printing") || text.includes("resuming") || text.includes("finishing")) state = "printing";
  else if (text.includes("error")) state = "error";
  else if (text.includes("offline") || text.includes("closed")) state = "offline";
  const t = printerDoc?.temperature ?? {};
  const tel = baseTelemetry("octoprint", serial, {
    state,
    job: job.job?.file?.display ?? job.job?.file?.name,
    progress: num(job.progress?.completion),
    printTime: num(job.progress?.printTime),
    bed: t.bed?.actual,
    nozzle: t.tool0?.actual,
    chamber: t.chamber?.actual,
    error: job.error || null,
    raw: { job, printer: printerDoc },
  });
  if (state === "offline") tel.connectionStatus = "disconnected";
  return tel;
}

/**
 * OctoPrint Application Keys: kullanıcı OctoPrint arayüzünde "İzin ver" der → API anahtarı.
 * Env/elle anahtar kopyalamaya gerek bırakmaz.
 */
export async function requestOctoPrintAppKey(host, port = 80, { app = "PrintFlow Bridge", timeoutMs = 120_000, onWaiting } = {}) {
  const res = await request("POST", host, port, "/plugin/appkeys/request", { body: { app } });
  if (res.status === 404) throw new Error("OctoPrint Application Keys eklentisi kapalı");
  if (res.status !== 201) throw new Error(`OctoPrint anahtar isteği HTTP ${res.status}`);
  const token = res.json?.app_token ?? String(res.headers.location ?? "").split("/").pop();
  if (!token) throw new Error("OctoPrint app_token dönmedi");
  onWaiting?.();
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 1000));
    const poll = await request("GET", host, port, `/plugin/appkeys/request/${encodeURIComponent(token)}`).catch(() => null);
    if (!poll) continue;
    if (poll.status === 200 && poll.json?.api_key) return poll.json.api_key;
    if (poll.status === 404) throw new Error("OctoPrint erişim isteği reddedildi veya süresi doldu");
  }
  throw new Error("OctoPrint onayı zaman aşımına uğradı");
}

// ---------------------------------------------------------------- PrusaLink (HTTP Digest)

export function parseDigestChallenge(header) {
  const h = String(header ?? "");
  if (!/^digest/i.test(h)) return null;
  const out = {};
  for (const m of h.slice(6).matchAll(/(\w+)=("([^"]*)"|[^,\s]*)/g)) out[m[1].toLowerCase()] = m[3] ?? m[2];
  return out;
}

const md5 = (s) => createHash("md5").update(s).digest("hex");

export function digestAuthorization({ username, password, method, uri, challenge, nc = 1, cnonce = randomBytes(8).toString("hex") }) {
  const ha1 = md5(`${username}:${challenge.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const qop = challenge.qop ? challenge.qop.split(",").map((s) => s.trim()).find((q) => q === "auth") : null;
  const ncHex = nc.toString(16).padStart(8, "0");
  const response = qop
    ? md5(`${ha1}:${challenge.nonce}:${ncHex}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${challenge.nonce}:${ha2}`);
  const parts = [
    `username="${username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ];
  if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`);
  if (qop) parts.push(`qop=${qop}`, `nc=${ncHex}`, `cnonce="${cnonce}"`);
  return `Digest ${parts.join(", ")}`;
}

async function prusaGet(printer, path) {
  const port = printer.lanPort > 0 ? printer.lanPort : 80;
  let res = await request("GET", printer.host, port, path, {
    headers: printer.apiKey ? { "X-Api-Key": printer.apiKey } : {},
  });
  if (res.status === 401 && printer.password) {
    const challenge = parseDigestChallenge(res.headers["www-authenticate"]);
    if (challenge) {
      res = await request("GET", printer.host, port, path, {
        headers: {
          Authorization: digestAuthorization({ username: printer.username || "maker", password: printer.password, method: "GET", uri: path, challenge }),
        },
      });
    }
  }
  if (res.status === 401) throw new Error("PrusaLink şifresi hatalı (yazıcı ekranı → Ayarlar → Ağ → PrusaLink)");
  return res;
}

export async function prusaLinkInfo(printer) {
  const res = await prusaGet(printer, "/api/v1/info");
  if (res.status === 200 && res.json) return { serial: res.json.serial ?? null, hostname: res.json.hostname ?? null };
  const legacy = await prusaGet(printer, "/api/version");
  return { serial: legacy.json?.serial ?? null, hostname: legacy.json?.hostname ?? null };
}

export async function pollPrusaLink(printer) {
  const st = await prusaGet(printer, "/api/v1/status");
  if (st.status === 200 && st.json?.printer) {
    let jobName = null;
    if (st.json.job) {
      const job = await prusaGet(printer, "/api/v1/job").catch(() => null);
      jobName = job?.json?.file?.display_name ?? job?.json?.file?.name ?? null;
    }
    return prusaLinkTelemetry(printer.serial, st.json, jobName);
  }
  const legacy = await prusaGet(printer, "/api/printer");
  if (legacy.status >= 300 || !legacy.json) throw new Error(`PrusaLink HTTP ${legacy.status}`);
  const job = await prusaGet(printer, "/api/job").catch(() => null);
  const t = legacy.json.temperature ?? {};
  const flags = legacy.json.state?.flags ?? {};
  const state = flags.paused ? "paused" : flags.printing ? "printing" : flags.error ? "error" : "idle";
  return baseTelemetry("prusalink", printer.serial, {
    state,
    job: job?.json?.job?.file?.display ?? job?.json?.job?.file?.name,
    progress: num(job?.json?.progress?.completion),
    printTime: num(job?.json?.progress?.printTime),
    bed: t.bed?.actual,
    nozzle: t.tool0?.actual,
    raw: legacy.json,
  });
}

export function prusaLinkTelemetry(serial, status, jobName) {
  const p = status.printer ?? {};
  const s = String(p.state ?? "").toUpperCase();
  const state =
    s === "PRINTING" ? "printing" : s === "PAUSED" ? "paused" : s === "ERROR" || s === "ATTENTION" ? "error" : "idle";
  return baseTelemetry("prusalink", serial, {
    state,
    job: jobName,
    progress: num(status.job?.progress),
    printTime: num(status.job?.time_printing),
    bed: p.temp_bed,
    nozzle: p.temp_nozzle,
    error: s === "ATTENTION" ? "Yazıcı dikkat bekliyor (ekranı kontrol edin)" : null,
    raw: status,
  });
}

// ---------------------------------------------------------------- Elegoo SDCP (WS 3030)

export function sdcpStatusRequest(mainboardId) {
  return {
    Id: "",
    Data: {
      Cmd: 0,
      Data: {},
      RequestID: randomBytes(16).toString("hex"),
      MainboardID: mainboardId,
      TimeStamp: Math.floor(Date.now() / 1000),
      From: 0,
    },
    Topic: `sdcp/request/${mainboardId}`,
  };
}

export function sdcpTelemetry(serial, status) {
  const cur = Array.isArray(status.CurrentStatus) ? status.CurrentStatus : [status.CurrentStatus];
  const pi = status.PrintInfo ?? {};
  const ps = Number(pi.Status);
  let state = "idle";
  if (cur.includes(1)) {
    if (ps === 5 || ps === 6) state = "paused";
    else if (ps === 8 || ps === 9) state = "idle";
    else state = "printing";
  }
  const progress =
    num(pi.Progress) ??
    (num(pi.TotalTicks) ? (num(pi.CurrentTicks) / num(pi.TotalTicks)) * 100 : null);
  return baseTelemetry("elegoo", serial, {
    state,
    job: pi.Filename,
    progress,
    printTime: num(pi.CurrentTicks),
    bed: status.TempOfHotbed,
    nozzle: status.TempOfNozzle,
    chamber: status.TempOfBox,
    raw: status,
  });
}

export function pollElegooSdcp(printer, { timeoutMs = 7000 } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${printer.host}:3030/websocket`, { handshakeTimeout: 5000 });
    const t = setTimeout(() => finish(new Error("SDCP zaman aşımı")), timeoutMs);
    const finish = (err, tel) => {
      clearTimeout(t);
      try {
        ws.terminate();
      } catch {
        /* */
      }
      if (err) reject(err);
      else resolve(tel);
    };
    ws.on("open", () => ws.send(JSON.stringify(sdcpStatusRequest(printer.serial))));
    ws.on("message", (data) => {
      let j;
      try {
        j = JSON.parse(data.toString());
      } catch {
        return;
      }
      const status = j.Status ?? j.Data?.Status;
      if (status && typeof status === "object") finish(null, sdcpTelemetry(printer.serial, status));
    });
    ws.on("error", (e) => finish(e));
  });
}

// ---------------------------------------------------------------- Flashforge TCP 8899

export function parseFlashforgeStatus({ m119 = "", m27 = "", m105 = "" }) {
  const ms = (m119.match(/MachineStatus:\s*(\S+)/i)?.[1] ?? "").toUpperCase();
  const file = m119.match(/CurrentFile:\s*([^\r\n]*)/i)?.[1]?.trim() || null;
  let state = "idle";
  if (ms === "PAUSED") state = "paused";
  else if (ms.startsWith("BUILDING") && ms !== "BUILDING_COMPLETED") state = "printing";
  const bytes = m27.match(/byte\s+(\d+)\s*\/\s*(\d+)/i);
  const progress = bytes && Number(bytes[2]) > 0 ? (Number(bytes[1]) / Number(bytes[2])) * 100 : null;
  const nozzle = m105.match(/T0:\s*([\d.]+)/i)?.[1];
  const bed = m105.match(/B:\s*([\d.]+)/i)?.[1];
  return { state, file, progress, nozzle, bed, machineStatus: ms };
}

function flashforgeExchange(host, port = 8899, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port });
    const cmds = ["~M601 S1", "~M119", "~M27", "~M105"];
    const replies = {};
    let buf = "";
    let i = 0;
    const done = (err) => {
      sock.removeAllListeners();
      try {
        sock.end("~M602\r\n");
      } catch {
        /* */
      }
      sock.destroy();
      if (err) reject(err);
      else resolve(replies);
    };
    sock.setTimeout(timeoutMs, () => done(new Error("Flashforge zaman aşımı")));
    sock.once("error", (e) => done(e));
    sock.once("connect", () => sock.write(`${cmds[0]}\r\n`));
    sock.on("data", (d) => {
      buf += d.toString("latin1");
      if (!/\bok\b/i.test(buf)) return;
      replies[cmds[i].slice(1).split(" ")[0].toLowerCase()] = buf;
      buf = "";
      i++;
      if (i >= cmds.length) done(null);
      else sock.write(`${cmds[i]}\r\n`);
    });
  });
}

export async function pollFlashforgeTcp(printer) {
  const r = await flashforgeExchange(printer.host);
  const s = parseFlashforgeStatus(r);
  return baseTelemetry("flashforge", printer.serial, {
    state: s.state,
    job: s.file,
    progress: s.progress,
    bed: s.bed,
    nozzle: s.nozzle,
    raw: { machineStatus: s.machineStatus },
  });
}
