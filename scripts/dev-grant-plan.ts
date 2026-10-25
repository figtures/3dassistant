/**
 * Yalnızca yerel geliştirme: Paddle olmadan bir hesaba plan tanımlar.
 *   npm run billing:dev-grant -- farm
 *   npm run billing:dev-grant -- free            (aboneliği kaldırır)
 *   npm run billing:dev-grant -- pro baska@ornek.com
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isPaidPlanKey, PLANS } from "../src/lib/billing/plans";

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  const value = line?.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
  if (!value) throw new Error(".env.local içinde DATABASE_URL yok");
  return value;
}

const [planArg = "farm", email = "dev.busraaktas@gmail.com"] = process.argv.slice(2);

if (planArg !== "free" && !isPaidPlanKey(planArg)) {
  console.error("Plan: free | starter | pro | farm");
  process.exit(1);
}

const sql =
  planArg === "free"
    ? `DELETE FROM subscriptions s USING auth.users u
       WHERE s.user_id = u.id AND u.email = :'email' AND s.paddle_subscription_id LIKE 'dev_%';`
    : `INSERT INTO subscriptions (
         user_id, paddle_subscription_id, paddle_customer_id, plan_key, status,
         max_machines, cloud_monitoring, sync_per_tick
       )
       SELECT u.id, 'dev_' || u.id, 'dev_' || u.id, :'plan', 'active',
              :max_machines, :cloud, :sync_per_tick
       FROM auth.users u WHERE u.email = :'email'
       ON CONFLICT (user_id) DO UPDATE SET
         plan_key = EXCLUDED.plan_key,
         status = 'active',
         max_machines = EXCLUDED.max_machines,
         cloud_monitoring = EXCLUDED.cloud_monitoring,
         sync_per_tick = EXCLUDED.sync_per_tick
       WHERE subscriptions.paddle_subscription_id LIKE 'dev_%';`;

const plan = PLANS[planArg];
const result = spawnSync(
  "psql",
  [
    loadDatabaseUrl(),
    "-v", "ON_ERROR_STOP=1",
    "-v", `email=${email}`,
    "-v", `plan=${plan.key}`,
    "-v", `max_machines=${plan.maxMachines}`,
    "-v", `cloud=${plan.cloudMonitoring}`,
    "-v", `sync_per_tick=${plan.syncPerTick}`,
  ],
  { input: sql, encoding: "utf8" }
);

if (result.status !== 0) {
  console.error(result.stderr || result.error?.message);
  process.exit(result.status ?? 1);
}
console.log(`✓ ${email} → ${plan.name} (${result.stdout.trim()})`);
