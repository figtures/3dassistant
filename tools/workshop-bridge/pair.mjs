#!/usr/bin/env node
/** @deprecated npm run bridge:pair kullanın */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "printflow-bridge", "cli.mjs");
const r = spawnSync(process.execPath, [cli, "pair"], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
