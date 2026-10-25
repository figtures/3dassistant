import os from "node:os";
import { loadConfig } from "./config.mjs";
import { discoverPrinters } from "./discovery/index.mjs";
import { listScanInterfaces } from "./discovery/net.mjs";
import { pollPrinter } from "./drivers.mjs";
import { readLogTail } from "./log-file.mjs";
import { redactSecretsDeep, summarizeConfig } from "./redact.mjs";

const AGENT = "printflow-bridge-node/0.2.0";

async function probePrinter(p) {
  try {
    await pollPrinter(p);
    return { serial: p.serial, host: p.host, vendor: p.vendor, ok: true };
  } catch (e) {
    return {
      serial: p.serial,
      host: p.host,
      vendor: p.vendor,
      ok: false,
      error: String(e instanceof Error ? e.message : e).slice(0, 200),
    };
  }
}

export async function buildSupportBundle(extra = {}) {
  const cfg = loadConfig();
  const discovery = await discoverPrinters({
    timeoutMs: 6000,
    scan: "auto",
    pairedPrinters: cfg?.printers ?? [],
  });

  const reachability = [];
  if (cfg?.printers?.length) {
    for (const p of cfg.printers.slice(0, 10)) {
      reachability.push(await probePrinter(p));
    }
  }

  const bundle = {
    schemaVersion: 1,
    agent: AGENT,
    collectedAt: new Date().toISOString(),
    os: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    interfaces: listScanInterfaces().map((i) => ({
      name: i.name,
      address: i.address,
      cidr: i.cidr,
    })),
    configSummary: summarizeConfig(cfg),
    discovery: redactSecretsDeep({
      version: discovery.version,
      scannedAt: discovery.scannedAt,
      durationMs: discovery.durationMs,
      warnings: discovery.warnings,
      printerCount: discovery.printers?.length ?? 0,
      printers: (discovery.printers ?? []).map((p) => ({
        vendor: p.vendor,
        host: p.host,
        serial: p.serial,
        paired: p.paired,
        supported: p.supported,
      })),
    }),
    printerReachability: reachability,
    logTail: readLogTail(80),
    ...extra,
  };

  return redactSecretsDeep(bundle);
}

export async function uploadSupportBundle(bundle, cfg) {
  if (!cfg?.printflowUrl || !cfg?.bridgeToken) {
    throw new Error("Köprü yapılandırması eksik (printflowUrl / bridgeToken). Önce pair yapın.");
  }
  const url = `${cfg.printflowUrl.replace(/\/$/, "")}/api/bridge/support-bundle`;
  const body = JSON.stringify({ bundle });
  if (body.length > 256 * 1024) {
    throw new Error("Tanılama paketi 256KB sınırını aşıyor");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.bridgeToken}`,
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Yükleme başarısız (${res.status})`);
  }
  return data;
}

export async function cmdSupport(args) {
  const asJson = Boolean(args.json);
  const doUpload = Boolean(args.upload);
  const bundle = await buildSupportBundle();
  const cfg = loadConfig();

  if (doUpload) {
    const result = await uploadSupportBundle(bundle, cfg);
    if (asJson) {
      console.log(JSON.stringify({ bundle, upload: result }, null, 2));
    } else {
      console.error(`Tanılama paketi yüklendi: ${result.bundleCode}`);
      console.error(`Panelde sorun bildirirken bu kod otomatik bağlanır.`);
    }
    return;
  }

  if (asJson) console.log(JSON.stringify(bundle, null, 2));
  else {
    console.error("PrintFlow köprü tanılama paketi (gizli alanlar maskelenmiş)");
    console.log(JSON.stringify(bundle, null, 2));
  }
}
