#!/usr/bin/env node
/**
 * Workspace RLS ve backfill doğrulaması (P3-01+).
 *
 *   set -a && source .env.local && set +a
 *   node scripts/rls-smoke.mjs
 *
 * İsteğe bağlı ikinci kullanıcı (çapraz kiracı):
 *   RLS_SMOKE_USER_B_EMAIL=... RLS_SMOKE_USER_B_PASSWORD=...
 * Birincil: E2E_EMAIL / E2E_PASSWORD veya RLS_SMOKE_USER_A_*.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
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
  } catch {
    /* ignore */
  }
}

function fail(msg) {
  console.error("✗", msg);
  process.exit(1);
}

function ok(msg) {
  console.log("✓", msg);
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey) {
  fail("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli");
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function checkBackfill() {
  const { data: profiles, error: pErr } = await admin.from("profiles").select("id");
  if (pErr) fail(`profiles okunamadı: ${pErr.message}`);

  const { data: workspaces, error: wErr } = await admin.from("workspaces").select("id");
  if (wErr) fail(`workspaces okunamadı (migration 029 uygulandı mı?): ${wErr.message}`);

  const { data: owners, error: mErr } = await admin
    .from("workspace_members")
    .select("workspace_id, user_id, role")
    .eq("role", "owner");
  if (mErr) fail(`workspace_members okunamadı: ${mErr.message}`);

  const profileIds = new Set((profiles ?? []).map((p) => p.id));
  const wsIds = new Set((workspaces ?? []).map((w) => w.id));

  for (const id of profileIds) {
    if (!wsIds.has(id)) {
      fail(`profil ${id} için workspace yok (backfill eksik)`);
    }
  }

  for (const row of owners ?? []) {
    if (row.workspace_id !== row.user_id) {
      fail(`owner üyeliği workspace_id !== user_id: ${row.workspace_id}`);
    }
    if (!profileIds.has(row.user_id) && profileIds.size > 0) {
      /* auth-only kullanıcı olabilir */
    }
  }

  ok(
    `backfill: ${profileIds.size} profil, ${wsIds.size} workspace, ${owners?.length ?? 0} owner üyeliği`,
  );
}

async function signInClient(email, password) {
  if (!anonKey) fail("NEXT_PUBLIC_SUPABASE_ANON_KEY gerekli (RLS istemci testleri için)");
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) fail(`giriş başarısız (${email}): ${error?.message ?? "user yok"}`);
  return { client, userId: data.user.id };
}

async function checkUserIsolation(email, password, otherUserId) {
  const { client, userId } = await signInClient(email, password);

  const { data: myWs, error: wsErr } = await client
    .from("workspaces")
    .select("id")
    .eq("id", userId);
  if (wsErr) fail(`workspaces RLS (${email}): ${wsErr.message}`);
  if ((myWs ?? []).length !== 1) {
    fail(`${email} kendi workspace'ini göremedi (beklenen 1, gelen ${myWs?.length ?? 0})`);
  }

  if (otherUserId && otherUserId !== userId) {
    const { data: foreignWs, error: fErr } = await client
      .from("workspaces")
      .select("id")
      .eq("id", otherUserId);
    if (fErr) fail(`workspaces RLS foreign: ${fErr.message}`);
    if ((foreignWs ?? []).length !== 0) {
      fail(`${email} başka kullanıcının workspace'ini gördü (${otherUserId})`);
    }

    const { data: foreignMembers, error: fmErr } = await client
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", otherUserId);
    if (fmErr) fail(`workspace_members RLS foreign: ${fmErr.message}`);
    if ((foreignMembers ?? []).length !== 0) {
      fail(`${email} başka workspace üyeliklerini gördü`);
    }
  }

  ok(`RLS izolasyon (${email})`);
}

const emailA =
  process.env.RLS_SMOKE_USER_A_EMAIL ||
  process.env.E2E_EMAIL ||
  process.env.RLS_SMOKE_EMAIL;
const passwordA =
  process.env.RLS_SMOKE_USER_A_PASSWORD ||
  process.env.E2E_PASSWORD ||
  process.env.RLS_SMOKE_PASSWORD;

const emailB = process.env.RLS_SMOKE_USER_B_EMAIL;
const passwordB = process.env.RLS_SMOKE_USER_B_PASSWORD;

await checkBackfill();

let userBId;
if (emailB && passwordB) {
  const b = await signInClient(emailB, passwordB);
  userBId = b.userId;
}

let userAId;
if (emailA && passwordA) {
  const a = await signInClient(emailA, passwordA);
  userAId = a.userId;
}

if (emailA && passwordA) {
  await checkUserIsolation(emailA, passwordA, userBId);
  if (emailB && passwordB && userAId) {
    await checkUserIsolation(emailB, passwordB, userAId);
  }
} else {
  console.log("ℹ E2E_EMAIL/E2E_PASSWORD yok — yalnızca backfill kontrolü yapıldı");
}

console.log("RLS smoke tamam");
