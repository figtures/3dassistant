import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LOCAL_DEV = join(dirname(fileURLToPath(import.meta.url)), "config.local.json");

/** Önce repo içi config.local.json (geliştirme), sonra kullanıcı dizini. */
export function configPath() {
  if (existsSync(LOCAL_DEV)) return LOCAL_DEV;
  const platform = process.platform;
  if (platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "PrintFlow Bridge", "config.json");
  }
  if (platform === "win32") {
    const base = process.env.ProgramData || "C:\\ProgramData";
    return join(base, "PrintFlow Bridge", "config.json");
  }
  return join(homedir(), ".config", "printflow-bridge", "config.json");
}

export function loadConfig() {
  const path = configPath();
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function saveConfig(cfg) {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
  return path;
}

export function upsertPrinter(cfg, entry) {
  if (!cfg.printers) cfg.printers = [];
  const i = cfg.printers.findIndex(
    (p) =>
      p.machineId === entry.machineId ||
      (p.vendor === entry.vendor && p.serial === entry.serial) ||
      (p.vendor === entry.vendor && p.mac && entry.mac && p.mac === entry.mac)
  );
  if (i >= 0) cfg.printers[i] = entry;
  else cfg.printers.push(entry);
}
