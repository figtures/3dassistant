#!/usr/bin/env node
/**
 * 019–023 migration dosyalarını sırayla uygular.
 *   PRODUCTION_DATABASE_URL=... node scripts/apply-pending-migrations.mjs
 * veya .env.local içinde DATABASE_URL
 */
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migDir = join(root, "supabase/migrations");

function loadDatabaseUrl() {
  if (process.env.PRODUCTION_DATABASE_URL) return process.env.PRODUCTION_DATABASE_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(join(root, ".env.local"), "utf8");
    const line = env.split("\n").find((l) => l.startsWith("PRODUCTION_DATABASE_URL="));
    if (line) return line.slice("PRODUCTION_DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
    const line2 = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
    if (line2) return line2.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
  } catch {
    /* ignore */
  }
  throw new Error("PRODUCTION_DATABASE_URL veya DATABASE_URL gerekli");
}

const from = Number(process.env.MIGRATION_FROM || 19);
const files = readdirSync(migDir)
  .filter((f) => /^0\d+_.*\.sql$/.test(f))
  .sort()
  .filter((f) => {
    const n = parseInt(f.slice(0, 3), 10);
    return n >= from;
  });

const db = loadDatabaseUrl();
console.log(`DB: ${db.replace(/:[^:@]+@/, ":***@")}`);
console.log("Dosyalar:", files.join(", "));

for (const f of files) {
  const path = join(migDir, f);
  console.log("→", f);
  const r = spawnSync("psql", [db, "-v", "ON_ERROR_STOP=1", "-X", "-f", path], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status ?? 1);
  }
}
console.log("✓ Migration tamam");
