import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { configPath } from "./config.mjs";

const MAX_BYTES = 512 * 1024;

export function logFilePath() {
  return join(dirname(configPath()), "bridge.log");
}

export function appendBridgeLog(line) {
  const path = logFilePath();
  mkdirSync(dirname(path), { recursive: true });
  const msg = `[${new Date().toISOString()}] ${line}\n`;
  try {
    if (existsSync(path) && statSync(path).size > MAX_BYTES) {
      const tail = readFileSync(path, "utf8").slice(-MAX_BYTES / 2);
      writeFileSync(path, tail, { mode: 0o600 });
    }
    appendFileSync(path, msg, { mode: 0o600 });
  } catch {
    /* ignore */
  }
}

export function readLogTail(maxLines = 80) {
  const path = logFilePath();
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  return lines.slice(-maxLines);
}
