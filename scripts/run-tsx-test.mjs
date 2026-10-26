import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const testFiles = process.argv.slice(2);

if (testFiles.length === 0) {
  console.error("Usage: node scripts/run-tsx-test.mjs <test-file.ts> [...]");
  process.exit(1);
}

const npmCache = path.join(root, ".cache", "npm");
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["--yes", "tsx@4.23.15", "--test", ...testFiles],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_cache: npmCache,
    },
  }
);

process.exit(result.status ?? 1);
