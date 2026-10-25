#!/usr/bin/env node
/**
 * apps/printflow-bridge/dist içindeki yayın artefaktları için SHA256 manifest üretir.
 *
 *   node scripts/cdn/generate-manifest.mjs
 *   NEXT_PUBLIC_PRINTFLOW_BRIDGE_VERSION=0.2.0 node scripts/cdn/generate-manifest.mjs --write
 */
import {
  createReadStream,
  existsSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const defaultDist = join(root, "apps/printflow-bridge/dist");

/** dist kökündeki dosyalar (staging dizinleri hariç). */
export function listDistArtifacts(distDir) {
  if (!existsSync(distDir)) return [];
  return readdirSync(distDir)
    .filter((name) => {
      const full = join(distDir, name);
      if (!statSync(full).isFile()) return false;
      if (name.startsWith(".")) return false;
      return true;
    })
    .sort();
}

export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}

/**
 * @param {{ distDir?: string; version?: string; prefix?: string }} opts
 * prefix: CDN yol öneki, örn. `v0.1.0` → artifact.path = `v0.1.0/foo.pkg`
 */
export async function generateManifest(opts = {}) {
  const distDir = opts.distDir ?? defaultDist;
  const version =
    opts.version?.trim() ||
    process.env.NEXT_PUBLIC_PRINTFLOW_BRIDGE_VERSION?.trim() ||
    process.env.PRINTFLOW_BRIDGE_VERSION?.trim() ||
    "0.1.0";
  const pathPrefix = opts.prefix ?? `v${version}`;

  const names = listDistArtifacts(distDir);
  const artifacts = [];
  for (const name of names) {
    const full = join(distDir, name);
    const sha256 = await sha256File(full);
    const size = statSync(full).size;
    artifacts.push({
      name,
      path: `${pathPrefix}/${name}`,
      sha256,
      size,
    });
  }

  return {
    product: "printflow-bridge",
    brand: "3dassistant",
    version,
    updatedAt: new Date().toISOString(),
    artifacts,
  };
}

async function main() {
  const write = process.argv.includes("--write");
  const distArg = process.argv.find((a) => a.startsWith("--dist="));
  const distDir = distArg ? distArg.slice("--dist=".length) : defaultDist;
  const manifest = await generateManifest({ distDir });
  const json = JSON.stringify(manifest, null, 2) + "\n";
  if (write) {
    const out = join(distDir, "manifest.json");
    writeFileSync(out, json);
    console.log("→", out);
  } else {
    process.stdout.write(json);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
