#!/usr/bin/env node
/**
 * Service role olmadan DATABASE_URL ile kullanıcı + abonelik (Supabase SQL).
 * node scripts/provision-tenant-sql.mjs info@3dyanimda.com 'Sifre' farm
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function dbUrl() {
  if (process.env.PRODUCTION_DATABASE_URL) return process.env.PRODUCTION_DATABASE_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const key of ["PRODUCTION_DATABASE_URL", "DATABASE_URL"]) {
    const line = env.split("\n").find((l) => l.startsWith(`${key}=`));
    if (line) return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("DATABASE_URL gerekli");
}

const [email, password, plan = "farm"] = process.argv.slice(2);
if (!email || !password) {
  console.error("Kullanım: node scripts/provision-tenant-sql.mjs <email> <password> [farm|pro|starter]");
  process.exit(1);
}

const plans = { starter: [5, false, 0], pro: [8, true, 8], farm: [40, true, 20] };
const p = plans[plan];
if (!p) process.exit(1);

const esc = (s) => s.replace(/'/g, "''");

const sql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  uid uuid;
  inst uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower('${esc(email)}');
  IF uid IS NULL THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      inst, uid, 'authenticated', 'authenticated', '${esc(email)}',
      crypt('${esc(password)}', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', '${esc(email)}'),
      'email', uid::text, NOW(), NOW(), NOW()
    );
  ELSE
    UPDATE auth.users SET
      encrypted_password = crypt('${esc(password)}', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW())
    WHERE id = uid;
  END IF;

  INSERT INTO profiles (id, email, full_name, company_name)
  VALUES (uid, '${esc(email)}', '3D Yanımda', '3D Yanımda')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, company_name = EXCLUDED.company_name;

  INSERT INTO subscriptions (
    user_id, paddle_subscription_id, paddle_customer_id, plan_key, status,
    max_machines, cloud_monitoring, sync_per_tick
  ) VALUES (
    uid, 'dev_' || uid::text, 'dev_' || uid::text, '${plan}', 'active',
    ${p[0]}, ${p[1]}, ${p[2]}
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_key = EXCLUDED.plan_key,
    status = 'active',
    max_machines = EXCLUDED.max_machines,
    cloud_monitoring = EXCLUDED.cloud_monitoring,
    sync_per_tick = EXCLUDED.sync_per_tick;

  RAISE NOTICE 'OK %', uid;
END $$;
`;

const r = spawnSync("psql", [dbUrl(), "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" });
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(r.status ?? 1);
}
console.log(r.stderr); // NOTICE
console.log(`✓ ${email} → ${plan}`);
