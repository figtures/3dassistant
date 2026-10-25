#!/usr/bin/env node
/**
 * Yönetici: Supabase kullanıcı + abonelik (dev_ paddle id).
 *   set -a && source .env.local && set +a
 *   node scripts/provision-tenant.mjs info@ornek.com 'Sifre123' farm
 *
 * Şifreyi repoya yazmayın — argv veya PROVISION_PASSWORD.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";

function loadEnv() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i);
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function dbUrl() {
  return (
    process.env.PRODUCTION_DATABASE_URL ||
    process.env.DATABASE_URL ||
    (() => {
      throw new Error("DATABASE_URL veya PRODUCTION_DATABASE_URL gerekli");
    })()
  );
}

const [email, passwordArg, planArg = "pro"] = process.argv.slice(2);
const password = passwordArg || process.env.PROVISION_PASSWORD;
if (!email || !password) {
  console.error("Kullanım: node scripts/provision-tenant.mjs <email> <password> [pro|farm|starter]");
  process.exit(1);
}

const plans = {
  starter: { max: 5, cloud: false, sync: 0 },
  pro: { max: 8, cloud: true, sync: 8 },
  farm: { max: 40, cloud: true, sync: 20 },
};
const plan = plans[planArg];
if (!plan) {
  console.error("Plan: starter | pro | farm");
  process.exit(1);
}

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

let userId;
if (existing) {
  userId = existing.id;
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });
  if (error) {
    console.error("Şifre güncelleme:", error.message);
    process.exit(1);
  }
  console.log("Mevcut kullanıcı güncellendi:", email);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    console.error("Kullanıcı oluşturma:", error?.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log("Kullanıcı oluşturuldu:", email);
}

const sql = `
INSERT INTO profiles (id, email, full_name)
VALUES ('${userId}', '${email.replace(/'/g, "''")}', '3D Yanımda')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

INSERT INTO subscriptions (
  user_id, paddle_subscription_id, paddle_customer_id, plan_key, status,
  max_machines, cloud_monitoring, sync_per_tick
) VALUES (
  '${userId}', 'dev_${userId}', 'dev_${userId}', '${planArg}', 'active',
  ${plan.max}, ${plan.cloud}, ${plan.sync}
)
ON CONFLICT (user_id) DO UPDATE SET
  plan_key = EXCLUDED.plan_key,
  status = 'active',
  max_machines = EXCLUDED.max_machines,
  cloud_monitoring = EXCLUDED.cloud_monitoring,
  sync_per_tick = EXCLUDED.sync_per_tick;
`;

const psql = spawnSync("psql", [dbUrl(), "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" });
if (psql.status !== 0) {
  console.error(psql.stderr);
  process.exit(psql.status ?? 1);
}

console.log(`✓ Abonelik: ${planArg} (cloud_monitoring=${plan.cloud})`);
console.log("Giriş:", email);
