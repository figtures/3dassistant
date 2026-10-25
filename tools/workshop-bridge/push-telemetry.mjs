#!/usr/bin/env node
/**
 * Tek satır JSON telemetri → PrintFlow bulutu.
 * config.local.json gerekir (pair.mjs sonrası).
 *
 * Örnek (manuel test):
 *   echo '{"connectionStatus":"connected","printerState":"idle","jobName":null,"progressPercent":null,"printTimeSeconds":null,"errorMessage":null,"raw":{}}' | node push-telemetry.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const dir = dirname(fileURLToPath(import.meta.url));
const configPath = join(dir, "config.local.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

async function push(telemetry) {
  const res = await fetch(`${config.printflowUrl}/api/bridge/telemetry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.bridgeToken}`,
    },
    body: JSON.stringify({ machineId: config.machineId, telemetry }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
}

function mapBambuJsonLine(line) {
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  const values = parsed.values ?? parsed;
  const state =
    values?.print_status?.value ??
    values?.gcode_state?.value ??
    parsed.printerState;
  let printerState = "unknown";
  const s = String(state ?? "").toLowerCase();
  if (s.includes("print") || s === "running") printerState = "printing";
  else if (s.includes("pause")) printerState = "paused";
  else if (s.includes("fail") || s.includes("error")) printerState = "error";
  else if (s === "idle" || s === "finish" || s === "finished") printerState = "idle";

  const progress =
    values?.mc_percent?.value ?? values?.print_progress?.value ?? parsed.progressPercent;

  return {
    connectionStatus: "connected",
    printerState,
    jobName: values?.subtask_name?.value ?? values?.gcode_file?.value ?? null,
    progressPercent: progress != null ? Number(progress) : null,
    printTimeSeconds: null,
    errorMessage: null,
    raw: { bridge: true, line: parsed },
  };
}

const rl = createInterface({ input: process.stdin });
for await (const line of rl) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  const telemetry = mapBambuJsonLine(trimmed);
  if (!telemetry) continue;
  try {
    await push(telemetry);
    process.stderr.write(`push ok ${telemetry.printerState}\n`);
  } catch (e) {
    process.stderr.write(`push fail: ${e.message}\n`);
  }
}
