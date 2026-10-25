#!/usr/bin/env node
/**
 * PrintFlow Bridge (Node) — Go kurulumu gerekmez.
 * Müşteri: imzalı installer (CI). Geliştirme: npm run bridge:pair / bridge:run / bridge:discover
 */

import readline from "node:readline";
import { loadConfig, saveConfig, upsertPrinter, configPath } from "./config.mjs";
import { fetchCameraFrame, pollPrinter } from "./drivers.mjs";
import { prusaLinkInfo, requestOctoPrintAppKey } from "./vendor-drivers.mjs";
import { discoverPrinters, rediscoverPrinter } from "./discovery/index.mjs";
import { markAccessCodes, pairingSerial, primaryCandidates, VENDOR_LABELS } from "./discovery/merge.mjs";
import { readSlicerAccessCodes } from "./discovery/slicer-secrets.mjs";
import { fetchBambuAccessCodes, readSlicerCloudToken, slicerSessionApp } from "./discovery/bambu-cloud.mjs";
import { parseDeepLink } from "./deeplink.mjs";
import { cmdSupport } from "./support.mjs";
import { appendBridgeLog } from "./log-file.mjs";

const AGENT = "printflow-bridge-node/0.2.0";
const EXIT_NEEDS_SELECTION = 3;

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

const log = (...m) => {
  console.error(...m);
  try {
    appendBridgeLog(m.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
  } catch {
    /* ignore */
  }
};

// ---------------------------------------------------------------- terminal girdi

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) =>
    rl.question(question, (a) => {
      rl.close();
      resolve(a.trim());
    })
  );
}

/** Şifre/erişim kodu: ekrana yansıtılmaz. */
function askSecret(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  rl._writeToOutput = (s) => {
    if (s.includes(question)) process.stderr.write(s);
    else if (!/[\r\n]/.test(s)) process.stderr.write("*".repeat(s.length));
  };
  return new Promise((resolve) =>
    rl.question(question, (a) => {
      rl.close();
      process.stderr.write("\n");
      resolve(a.trim());
    })
  );
}

// ---------------------------------------------------------------- ortak

function interactive(args) {
  return Boolean(process.stdin.isTTY) && !args.yes;
}

function hostsArg(v) {
  if (!v || v === true) return [];
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function printTable(printers) {
  if (!printers.length) return;
  printers.forEach((p, i) => {
    const title = [p.vendorLabel, p.model, p.name && p.name !== p.model ? `“${p.name}”` : null].filter(Boolean).join(" · ");
    const flags = [p.paired ? "✓ eşleşmiş" : null, p.supported ? null : "desteklenmiyor"].filter(Boolean).join(", ");
    log(`  ${String(i + 1).padStart(2)}) ${title}${flags ? `  [${flags}]` : ""}`);
    log(`      IP ${p.host}${p.serial ? `  seri ${p.serial}` : ""}${p.mac ? `  MAC ${p.mac}` : ""}  (${p.methods.join("+")})`);
    for (const n of p.notes) log(`      • ${n}`);
  });
}

function printWarnings(res) {
  for (const w of res.warnings) log(`! ${w}`);
  for (const [m, info] of Object.entries(res.methods)) {
    for (const e of info.errors ?? []) log(`  (${m}) ${e}`);
  }
}

async function runDiscovery(args, extra = {}) {
  const cfg = loadConfig();
  const slicer = args["no-slicer-codes"] ? { codes: new Map(), sources: [] } : readSlicerAccessCodes();
  const scan = args.scan === true ? "always" : args.scan || "auto";
  if (!args.json) log("Yerel ağda yazıcılar aranıyor (SSDP, mDNS, SDCP, UDP; gerekirse port taraması)…");
  const res = await discoverPrinters({
    timeoutMs: Number(args.timeout) || 6000,
    scan,
    hosts: [...hostsArg(args.host), ...(extra.hosts ?? [])],
    pairedPrinters: cfg?.printers ?? [],
    slicerCodes: slicer.codes,
    onProgress: (p) => {
      if (args.json) return;
      if (p.phase === "scan" && p.total) process.stderr.write(`\r  port taraması ${p.done}/${p.total}   `);
      else if (p.phase === "scan") log("Yayınla bulunamadı; bilinen portlarda tarama yapılıyor…");
    },
  });
  if (!args.json) process.stderr.write("\r");
  const cloud = await addCloudCodes(args, res, { allowPrompt: Boolean(extra.allowPrompt) && interactive(args) });
  return { res, slicer, cloud, cfg };
}

/**
 * Bambu hesabından erişim kodu: jeton (--bambu-token / BAMBU_CLOUD_TOKEN) veya onaylı Bambu Studio
 * oturumu ile yalnızca bu bilgisayardan Bambu API'sine gidilir. Kodlar JSON'a/loglara/PrintFlow'a yazılmaz.
 */
let cloudCache = null;

async function addCloudCodes(args, res, { allowPrompt = false } = {}) {
  const codes = new Map();
  const info = { tokenSource: null, slicerSession: null, codesFound: 0, error: null };
  res.bambuCloud = info;
  const missing = res.printers.filter((p) => p.vendor === "bambu" && p.serial && !p.secretAvailable && !p.paired);
  if (cloudCache) {
    Object.assign(info, cloudCache.info, { codesFound: missing.filter((p) => cloudCache.codes.has(p.serial)).length });
    markAccessCodes(res.printers, cloudCache.codes, "Bambu hesabı");
    return cloudCache.codes;
  }
  if (!missing.length || args["no-cloud-codes"]) return codes;

  let token = typeof args["bambu-token"] === "string" ? args["bambu-token"] : process.env.BAMBU_CLOUD_TOKEN || null;
  if (token) info.tokenSource = "token";
  else if (!args["no-slicer-token"] && !args["no-slicer-codes"]) {
    const app = slicerSessionApp();
    info.slicerSession = app ? "present" : "missing";
    let use = Boolean(app && args["use-slicer-token"]);
    if (app && !use && allowPrompt) {
      const a = await ask(
        `${app} Bambu oturumu bulundu. Erişim kodu Bambu hesabınızdan alınsın mı? (yalnızca bu bilgisayardan Bambu'ya; PrintFlow'a gönderilmez) [E/h] `
      );
      use = !/^h/i.test(a);
      if (!use) cloudCache = { codes, info: { ...info } };
    } else if (app && !use) {
      res.warnings.push(`${app} Bambu oturumu bulundu; --use-slicer-token ile erişim kodu otomatik alınabilir.`);
    }
    if (use) {
      const st = readSlicerCloudToken();
      info.slicerSession = st.status;
      if (st.token) {
        token = st.token;
        info.tokenSource = "slicer";
      } else if (st.status === "encrypted") {
        res.warnings.push(`${app} oturumu şifreli saklanıyor; jeton okunamadı (--bambu-token verin veya kodu girin).`);
      }
    }
  }
  if (!token) return codes;
  try {
    const region = args["bambu-region"] === "cn" ? "cn" : "global";
    for (const [s, c] of await fetchBambuAccessCodes(token, { region })) codes.set(s, c);
    markAccessCodes(res.printers, codes, "Bambu hesabı");
    info.codesFound = missing.filter((p) => codes.has(p.serial)).length;
    cloudCache = { codes, info: { ...info } };
    if (!info.codesFound) res.warnings.push("Bambu hesabında bu ağdaki yazıcıların erişim kodu bulunamadı (yazıcı başka hesaba bağlı olabilir).");
  } catch (e) {
    info.error = e instanceof Error ? e.message : String(e);
    res.warnings.push(`Bambu hesabından erişim kodu alınamadı: ${info.error}`);
  }
  return codes;
}

// ---------------------------------------------------------------- discover

async function cmdDiscover(args) {
  const { res } = await runDiscovery(args);
  if (args.json) {
    process.stdout.write(JSON.stringify(res, null, 2) + "\n");
    return;
  }
  log(`\n${res.printers.length} cihaz bulundu (${(res.durationMs / 1000).toFixed(1)} sn, arayüzler: ${res.interfaces.map((i) => `${i.name} ${i.cidr}`).join(", ") || "yok"})`);
  printTable(res.printers);
  printWarnings(res);
}

// ---------------------------------------------------------------- pair

function parseSelection(input, printers) {
  const s = input.trim().toLowerCase();
  if (s === "a") return primaryCandidates(printers).filter((p) => p.supported && !p.paired);
  const idx = s
    .split(/[\s,]+/)
    .map((x) => Number(x) - 1)
    .filter((n) => Number.isInteger(n) && n >= 0 && n < printers.length);
  return [...new Set(idx)].map((i) => printers[i]);
}

async function pickPrinters(args, state) {
  for (;;) {
    const { res } = state;
    log(`\nBulunan yazıcılar (${res.printers.length}):`);
    printTable(res.printers);
    printWarnings(res);
    log("\nSeçim: numara (1 veya 1,3) · a = eşleşmemiş tümü · m = IP elle gir · r = yeniden ara · q = çık");
    const answer = (await ask("> ")).toLowerCase();
    if (answer === "q") return [];
    if (answer === "r") {
      state.res = (await runDiscovery({ ...args, scan: "always" }, { allowPrompt: true })).res;
      continue;
    }
    if (answer === "m") {
      const ip = await ask("Yazıcı IP adresi: ");
      if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
        log("Geçersiz IPv4 adresi.");
        continue;
      }
      const { res: r2 } = await runDiscovery({ ...args, scan: "never", timeout: 1500 }, { hosts: [ip], allowPrompt: true });
      const merged = new Map(res.printers.map((p) => [p.id, p]));
      for (const p of r2.printers) merged.set(p.id, p);
      state.res = { ...res, printers: [...merged.values()], warnings: r2.warnings };
      continue;
    }
    const chosen = parseSelection(answer, res.printers).filter((p) => {
      if (!p.supported) log(`- ${p.vendorLabel} (${p.host}) desteklenmiyor, atlandı.`);
      return p.supported;
    });
    if (chosen.length) return chosen;
    log("Seçim anlaşılamadı.");
  }
}

function autoSelect(args, printers, slicerCodes, cloudCodes) {
  if (args.all) return primaryCandidates(printers).filter((p) => p.supported && !p.paired);
  if (args.select) {
    const ids = String(args.select).split(",").map((s) => s.trim());
    return printers.filter((p) => ids.includes(p.id) && p.supported);
  }
  const open = primaryCandidates(printers).filter((p) => p.supported && !p.paired);
  if (open.length !== 1) return null;
  const p = open[0];
  const secretOk =
    !p.needsSecret ||
    (p.needsSecret === "bambu_access_code" &&
      (args["access-code"] ||
        process.env.BAMBU_ACCESS_CODE ||
        cloudCodes.has(p.serial) ||
        (args["use-slicer-codes"] && slicerCodes.has(p.serial)))) ||
    (p.needsSecret === "prusalink_password" && args.password) ||
    (p.needsSecret === "octoprint_api_key") ||
    (p.needsSecret === "moonraker_api_key" && args["api-key"]);
  return secretOk ? [p] : null;
}

const isSecretError = (msg) => /erişim kodu|şifre|yetki|API anahtarı|Not authori/i.test(msg);

/** Seçilen yazıcı için yerel sır + doğrulama. Başarısızsa null (atla). */
async function prepareEntry(p, args, ctx) {
  const entry = {
    vendor: p.vendor,
    host: p.host,
    serial: pairingSerial(p),
    mac: p.mac ?? undefined,
    model: p.model ?? undefined,
    label: p.name || p.model || `${VENDOR_LABELS[p.vendor] ?? p.vendor} ${pairingSerial(p).slice(-6)}`,
    lanPort: ctx.legacy || (p.lanPort && !["bambu", "elegoo"].includes(p.vendor)) ? p.lanPort || 0 : 0,
  };
  const tty = interactive(args);

  const obtainSecret = async (attempt) => {
    switch (p.vendor) {
      case "bambu": {
        if (attempt === 0 && (args["access-code"] || process.env.BAMBU_ACCESS_CODE) && ctx.selectedCount === 1) {
          entry.accessCode = args["access-code"] || process.env.BAMBU_ACCESS_CODE;
          return true;
        }
        const fromCloud = (cloudCache?.codes ?? ctx.cloudCodes)?.get(p.serial);
        if (attempt === 0 && fromCloud) {
          entry.accessCode = fromCloud;
          return true;
        }
        const fromSlicer = ctx.slicerCodes.get(p.serial);
        if (attempt === 0 && fromSlicer) {
          let use = Boolean(args["use-slicer-codes"]);
          if (!use && tty) {
            const a = await ask(`${ctx.slicerSources.join("/")} ayarlarında ${p.serial} için erişim kodu bulundu, kullanılsın mı? [E/h] `);
            use = !/^h/i.test(a);
          }
          if (use) {
            entry.accessCode = fromSlicer;
            return true;
          }
        }
        if (!tty) return false;
        if (attempt === 0) {
          if (p.model === "X2D" || p.extra?.modelCode === "N6") {
            log(`  Bambu Lab X2D: dokunmatik ekran → Ayarlar (⚙) → Ağ / Wi-Fi → Access Code (8 karakter).`);
            log(`  Yerel MQTT için gerekirse LAN Only veya Developer Mode (firmware sürümüne bağlı).`);
          } else {
            log(`  Erişim kodu: yazıcı ekranı → Ayarlar → Ağ/WLAN → LAN Only / Access Code (8 karakter).`);
          }
          log(`  Kod girmeden: PrintFlow → Makineler → Yazıcıları bağla (bulut telemetri) veya --use-slicer-token / --bambu-token.`);
        }
        entry.accessCode = await askSecret(`${p.name || p.model || p.serial} erişim kodu: `);
        return Boolean(entry.accessCode);
      }
      case "prusalink":
        if (attempt === 0 && args.password) entry.password = args.password;
        else if (tty) entry.password = await askSecret(`PrusaLink şifresi (${p.host}, ekran → Ayarlar → Ağ): `);
        else return false;
        return Boolean(entry.password);
      case "octoprint":
        if (attempt === 0 && args["api-key"]) {
          entry.apiKey = args["api-key"];
          return true;
        }
        if (attempt === 0) {
          try {
            entry.apiKey = await requestOctoPrintAppKey(p.host, p.lanPort || 80, {
              onWaiting: () => log(`OctoPrint (${p.host}) arayüzünde “PrintFlow Bridge” erişim isteğini onaylayın…`),
            });
            return true;
          } catch (e) {
            log(`OctoPrint otomatik anahtar alınamadı: ${e.message}`);
          }
        }
        if (!tty) return false;
        entry.apiKey = await askSecret("OctoPrint API anahtarı (Ayarlar → Application Keys): ");
        return Boolean(entry.apiKey);
      case "klipper":
        if (p.needsSecret !== "moonraker_api_key") return true;
        if (attempt === 0 && args["api-key"]) entry.apiKey = args["api-key"];
        else if (tty) entry.apiKey = await askSecret("Moonraker API anahtarı: ");
        else return false;
        return Boolean(entry.apiKey);
      default:
        return true;
    }
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await obtainSecret(attempt))) {
      log(`- ${entry.label}: gerekli erişim bilgisi yok, atlandı (etkileşimli çalıştırın veya bayrakla verin).`);
      return null;
    }
    try {
      if (p.vendor === "prusalink") {
        const info = await prusaLinkInfo(entry);
        if (info.serial) entry.serial = info.serial;
      }
      const tel = await pollPrinter(entry);
      delete entry._configDirty;
      log(`✓ ${entry.label} (${entry.host}) okundu: ${tel.printerState}`);
      return entry;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`✗ ${entry.label}: ${msg}`);
      if (ctx.legacy && !isSecretError(msg)) {
        // Eski akış (IP + seri elle): yazıcıya şu an ulaşılamasa da eşleştir — önceki davranış.
        log("  Uyarı: yazıcı şu an okunamadı; eşleştirme yine de yapılıyor.");
        return entry;
      }
      if (!tty || !isSecretError(msg)) {
        if (tty && (await ask("Yine de eşleştirilsin mi? (telemetri bağlantı kurulunca gelir) [e/H] ")).toLowerCase().startsWith("e")) {
          return entry;
        }
        return null;
      }
    }
  }
  return null;
}

async function pairApi(url, body) {
  const res = await fetch(`${url}/api/bridge/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: e.message }) }));
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function resolveUrlAndCode(args) {
  let url = (args.url || process.env.PRINTFLOW_URL || "").replace(/\/$/, "");
  let code = args.code || process.env.PAIRING_CODE;
  if (args["deep-link"]) ({ url, code } = parseDeepLink(args["deep-link"]));
  const cfg = loadConfig();
  if (!url && cfg?.printflowUrl) url = cfg.printflowUrl;
  if (interactive(args)) {
    if (!url) url = (await ask("PrintFlow adresi (ör. https://app.printflow…): ")).replace(/\/$/, "");
    if (!code) code = (await ask("Panelden aldığınız 6 haneli eşleştirme kodu: ")).replace(/\s/g, "");
  }
  return { url, code };
}

async function cmdPair(args) {
  const { url, code } = await resolveUrlAndCode(args);
  if (!url || !code) {
    log("Kullanım: npm run bridge:pair -- --url URL --code 123456   (yazıcılar otomatik bulunur)");
    log("       veya: npm run bridge:pair -- --deep-link 'printflow://pair?code=…&url=…'");
    process.exit(1);
  }

  const legacyHost = args.host || process.env.PRINTER_HOST || process.env.BAMBU_HOST;
  const legacySerial = args.serial || process.env.PRINTER_SERIAL || process.env.BAMBU_SERIAL;
  let selected;
  let slicerCodes = new Map();
  let slicerSources = [];
  let cloudCodes = new Map();

  if (legacyHost && legacySerial) {
    // Eski akış: IP + seri elle verildi — keşif atlanır.
    const vendor = (args.vendor || process.env.PRINTER_VENDOR || "bambu").toLowerCase();
    selected = [
      {
        id: `${vendor}:${legacySerial}`,
        vendor,
        vendorLabel: VENDOR_LABELS[vendor] ?? vendor,
        supported: true,
        host: legacyHost,
        serial: legacySerial,
        mac: null,
        model: null,
        name: args.name || null,
        lanPort: Number(args["lan-port"] || process.env.LAN_PORT || 0) || null,
        needsSecret: vendor === "bambu" ? "bambu_access_code" : null,
        paired: false,
      },
    ];
  } else {
    const { res, slicer, cloud } = await runDiscovery(
      { ...args, host: undefined },
      { hosts: hostsArg(legacyHost), allowPrompt: true }
    );
    slicerCodes = slicer.codes;
    slicerSources = slicer.sources;
    cloudCodes = cloud;
    let printers = res.printers;
    if (legacyHost) printers = printers.filter((p) => hostsArg(legacyHost).includes(p.host));
    if (args.vendor && args.vendor !== true) printers = printers.filter((p) => p.vendor === String(args.vendor).toLowerCase());
    const state = { res: { ...res, printers } };

    selected = autoSelect(args, printers, slicerCodes, cloudCodes);
    if (!selected && interactive(args)) selected = await pickPrinters(args, state);
    if (!selected) {
      if (args.json) process.stdout.write(JSON.stringify(state.res, null, 2) + "\n");
      else {
        printTable(printers);
        printWarnings(state.res);
      }
      log(
        printers.some((p) => p.supported && !p.paired)
          ? "\nBirden fazla yazıcı var veya erişim kodu gerekiyor: etkileşimli çalıştırın ya da --select ID[,ID] / --all ve gerekli bayrakları verin."
          : "\nEşleştirilecek yeni yazıcı bulunamadı."
      );
      process.exit(EXIT_NEEDS_SELECTION);
    }
    if (!selected.length) process.exit(0);
  }

  const results = [];
  let cfg = loadConfig();
  for (const p of selected) {
    const entry = await prepareEntry(p, args, {
      slicerCodes,
      slicerSources,
      cloudCodes,
      selectedCount: selected.length,
      legacy: Boolean(legacyHost && legacySerial),
    });
    if (!entry) {
      results.push({ id: p.id, ok: false, error: "doğrulanamadı / atlandı" });
      continue;
    }
    const body = {
      code,
      machineName: selected.length === 1 && args.name && args.name !== true ? args.name : undefined,
      bridgeToken: cfg?.bridgeToken,
      agentVersion: AGENT,
      printer: { vendor: entry.vendor, serial: entry.serial, host: entry.host, label: entry.label, model: entry.model },
    };
    const r = await pairApi(url, body);
    if (!r.ok) {
      const msg =
        r.status === 401 && /kod/i.test(r.data.error ?? "")
          ? "Eşleştirme kodu geçersiz veya süresi doldu — panelden yeni kod alın"
          : r.status === 0
            ? `PrintFlow'a ulaşılamadı (${url}): ${r.data.error}`
            : (r.data.error ?? `HTTP ${r.status}`);
      log(`✗ ${entry.label}: ${msg}`);
      results.push({ id: p.id, ok: false, error: msg });
      if (r.status === 401 || r.status === 402) break;
      continue;
    }
    cfg = cfg ?? { printflowUrl: url, bridgeToken: r.data.bridgeToken, printers: [] };
    cfg.printflowUrl = url;
    cfg.bridgeToken = r.data.bridgeToken;
    upsertPrinter(cfg, {
      ...entry,
      machineId: r.data.machineId,
      bambuTlsServerName: entry.vendor === "bambu" ? process.env.BAMBU_TLS_SERVER_NAME || entry.serial : undefined,
      bambuTlsInsecure: entry.vendor === "bambu" ? process.env.BAMBU_TLS_INSECURE === "true" : undefined,
    });
    saveConfig(cfg);
    log(`✓ ${entry.label} bağlandı → makine ${r.data.machineId}`);
    results.push({ id: p.id, ok: true, machineId: r.data.machineId });
  }

  if (args.json) process.stdout.write(JSON.stringify({ results, configPath: configPath() }, null, 2) + "\n");
  const okCount = results.filter((r) => r.ok).length;
  log(`\n${okCount}/${results.length} yazıcı eşleştirildi. Yapılandırma: ${configPath()}`);
  if (okCount) log("Telemetri: npm run bridge:run");
  if (!okCount) process.exit(1);
}

// ---------------------------------------------------------------- run

async function postJson(cfg, path, payload, method = "POST") {
  const res = await fetch(`${cfg.printflowUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.bridgeToken}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
}

const pushCamera = (cfg, machineId, frame) =>
  postJson(cfg, "/api/bridge/camera", {
    machineId,
    imageBase64: frame.buffer.toString("base64"),
    contentType: frame.contentType,
  });

const pushTelemetry = (cfg, machineId, telemetry) => postJson(cfg, "/api/bridge/telemetry", { machineId, telemetry });

const REDISCOVER_AFTER_FAILS = 3;
const REDISCOVER_COOLDOWN_MS = 5 * 60_000;

/** DHCP ile IP değişti mi? Seri/MAC ile yeniden bul, config + buluttaki host'u güncelle. */
async function maybeRediscover(cfg, p, st) {
  if (st.fails < REDISCOVER_AFTER_FAILS || Date.now() - st.lastRediscover < REDISCOVER_COOLDOWN_MS) return;
  st.lastRediscover = Date.now();
  process.stderr.write(`rediscover ${p.vendor} ${p.serial}…\n`);
  const hit = await rediscoverPrinter(p).catch(() => null);
  if (!hit || hit.host === p.host) return;
  process.stderr.write(`IP değişti: ${p.host} → ${hit.host} (${p.serial})\n`);
  p.host = hit.host;
  if (hit.mac && !p.mac) p.mac = hit.mac;
  saveConfig(cfg);
  st.fails = 0;
  await postJson(cfg, "/api/bridge/bindings", { machineId: p.machineId, host: hit.host }, "PATCH").catch((e) =>
    process.stderr.write(`bulut host güncellenemedi: ${e.message}\n`)
  );
}

async function cmdRun() {
  const cfg = loadConfig();
  if (!cfg?.bridgeToken || !cfg.printers?.length) {
    log("Önce: npm run bridge:pair — veya config:", configPath());
    process.exit(1);
  }
  log(`PrintFlow Bridge (Node) — ${cfg.printers.length} yazıcı, 5s telemetri + kamera`);
  const lastCameraAt = new Map();
  const state = new Map();
  for (;;) {
    for (const p of cfg.printers) {
      const st = state.get(p.machineId) ?? { fails: 0, lastRediscover: 0 };
      state.set(p.machineId, st);
      try {
        const telemetry = await pollPrinter(p);
        if (p._configDirty) {
          delete p._configDirty;
          saveConfig(cfg);
        }
        st.fails = 0;
        await pushTelemetry(cfg, p.machineId, telemetry);
        const active = telemetry.printerState === "printing" || telemetry.printerState === "paused";
        const camIntervalMs = active ? 2500 : 30_000;
        const last = lastCameraAt.get(p.machineId) ?? 0;
        if (Date.now() - last >= camIntervalMs) {
          const frame = await fetchCameraFrame(p);
          if (frame) {
            await pushCamera(cfg, p.machineId, frame);
            lastCameraAt.set(p.machineId, Date.now());
          }
        }
        process.stderr.write(`ok ${p.vendor} ${p.serial} ${telemetry.printerState}\n`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        st.fails++;
        process.stderr.write(`fail ${p.serial}: ${msg}\n`);
        await pushTelemetry(cfg, p.machineId, {
          connectionStatus: "error",
          printerState: "offline",
          jobName: null,
          progressPercent: null,
          printTimeSeconds: null,
          errorMessage: msg,
          raw: { vendor: p.vendor },
        }).catch(() => {});
        if (!isSecretError(msg)) await maybeRediscover(cfg, p, st);
      }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

// ---------------------------------------------------------------- main

const [cmd, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

try {
  if (cmd === "pair") await cmdPair(args);
  else if (cmd === "open-url") await cmdPair({ ...args, "deep-link": args._[0] });
  else if (cmd === "discover") await cmdDiscover(args);
  else if (cmd === "run") await cmdRun();
  else if (cmd === "config-path") console.log(configPath());
  else if (cmd === "support") await cmdSupport(args);
  else {
    console.log(`PrintFlow Bridge (Node) ${AGENT}
  npm run bridge:discover [-- --json] [--host IP] [--scan always]
  npm run bridge:pair -- --url URL --code 123456          (yazıcılar otomatik bulunur, listeden seçilir)
  npm run bridge:pair -- --deep-link "printflow://pair?code=…&url=…"
  npm run bridge:run
  npm run bridge:support [-- --json] [--upload]
Eski kullanım da geçerli: --vendor --host --serial --access-code
Bayraklar: --select ID[,ID] --all --yes --json --api-key --password --use-slicer-codes --no-slicer-codes --timeout MS
Bambu kodu hesaptan (yalnızca yerel): --bambu-token JWT (veya BAMBU_CLOUD_TOKEN) --use-slicer-token --no-slicer-token
  --no-cloud-codes --bambu-region global|cn
`);
  }
} catch (e) {
  log(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
