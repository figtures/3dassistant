#!/usr/bin/env node
/**
 * PrintFlow Bridge artefaktlarını CDN köküne kopyalar / yükler (manifest + SHA256).
 *
 * Yerel (rsync örneği):
 *   BRIDGE_CDN_DEST=/var/www/cdn/bridge/releases node scripts/cdn/publish-bridge.mjs
 *
 * S3 uyumlu:
 *   BRIDGE_S3_BUCKET=cdn-3dyanimda BRIDGE_S3_PREFIX=bridge/releases node scripts/cdn/publish-bridge.mjs
 *
 * Yükleme sonrası HEAD doğrulama (public URL):
 *   BRIDGE_CDN_PUBLIC_BASE_URL=https://cdn.3dyanimda.com/bridge/releases node scripts/cdn/publish-bridge.mjs
 *
 * Env: NEXT_PUBLIC_PRINTFLOW_BRIDGE_VERSION (ör. 0.1.0)
 */
import {
  existsSync,
  readdirSync,
  copyFileSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { generateManifest } from "./generate-manifest.mjs";

const version =
  process.env.NEXT_PUBLIC_PRINTFLOW_BRIDGE_VERSION?.trim() ||
  process.env.PRINTFLOW_BRIDGE_VERSION?.trim() ||
  "0.1.0";
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const dist = join(root, "apps/printflow-bridge/dist");
const pathPrefix = `v${version}`;

const publicBase =
  process.env.BRIDGE_CDN_PUBLIC_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_PRINTFLOW_BRIDGE_BASE_URL?.trim() ||
  "";

async function verifyPublishedUrls(manifest) {
  if (!publicBase) {
    console.log("HEAD doğrulama atlandı (BRIDGE_CDN_PUBLIC_BASE_URL veya NEXT_PUBLIC_PRINTFLOW_BRIDGE_BASE_URL yok).");
    return;
  }
  const base = publicBase.replace(/\/$/, "");
  const targets = [
    ...manifest.artifacts.map((a) => `${base}/${a.path}`),
    `${base}/manifest.json`,
    `${base}/latest.json`,
  ];
  for (const url of targets) {
    let res;
    try {
      res = await fetch(url, { method: "HEAD", redirect: "follow" });
    } catch (err) {
      console.error(`HEAD başarısız (${url}):`, err.message);
      process.exit(1);
    }
    if (!res.ok) {
      console.error(`HEAD ${res.status} ${url}`);
      process.exit(1);
    }
    console.log(`OK HEAD ${url}`);
  }
}

const manifest = await generateManifest({ distDir: dist, version, prefix: pathPrefix });

if (!existsSync(dist) || manifest.artifacts.length === 0) {
  console.error("dist/ boş veya yok — önce apps/printflow-bridge/installers/build-all.sh");
  process.exit(1);
}

const manifestJson = JSON.stringify(manifest, null, 2) + "\n";
const manifestDistPath = join(dist, "manifest.json");
writeFileSync(manifestDistPath, manifestJson);

const latest = {
  ...manifest,
  latest: pathPrefix,
};

const dest = process.env.BRIDGE_CDN_DEST;
if (dest) {
  const target = join(dest, pathPrefix);
  mkdirSync(target, { recursive: true });
  for (const a of manifest.artifacts) {
    copyFileSync(join(dist, a.name), join(target, a.name));
  }
  copyFileSync(manifestDistPath, join(target, "manifest.json"));
  writeFileSync(join(dest, "latest.json"), JSON.stringify(latest, null, 2) + "\n");
  writeFileSync(join(dest, "manifest.json"), manifestJson);
  console.log("CDN yerel:", dest);
}

const bucket = process.env.BRIDGE_S3_BUCKET;
if (bucket) {
  const prefix = (process.env.BRIDGE_S3_PREFIX || "bridge/releases").replace(/\/$/, "");
  const versionUri = `s3://${bucket}/${prefix}/${pathPrefix}/`;
  const sync = spawnSync(
    "aws",
    ["s3", "sync", dist, versionUri, "--acl", "public-read"],
    { stdio: "inherit" }
  );
  if (sync.status !== 0) process.exit(sync.status ?? 1);

  const tmpLatest = join(dist, ".publish-latest.json");
  writeFileSync(tmpLatest, JSON.stringify(latest, null, 2) + "\n");
  const putLatest = spawnSync(
    "aws",
    [
      "s3",
      "cp",
      tmpLatest,
      `s3://${bucket}/${prefix}/latest.json`,
      "--acl",
      "public-read",
      "--content-type",
      "application/json",
    ],
    { stdio: "inherit" }
  );
  if (putLatest.status !== 0) process.exit(putLatest.status ?? 1);

  const putManifest = spawnSync(
    "aws",
    [
      "s3",
      "cp",
      manifestDistPath,
      `s3://${bucket}/${prefix}/manifest.json`,
      "--acl",
      "public-read",
      "--content-type",
      "application/json",
    ],
    { stdio: "inherit" }
  );
  if (putManifest.status !== 0) process.exit(putManifest.status ?? 1);

  console.log(`S3: ${versionUri}`);
}

if (!dest && !bucket) {
  console.log("Manifest (yüklemek için BRIDGE_CDN_DEST veya BRIDGE_S3_BUCKET):");
  console.log(manifestJson);
  console.log("\nNode köprü (Go olmadan): tools/printflow-bridge — müşteri npm paketi yerine installer binary.");
  process.exit(0);
}

await verifyPublishedUrls(manifest);
