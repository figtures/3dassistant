import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePairingCode, hashPairingCode } from "@/lib/bridge/crypto";
import { cloudRequiredMessage, getEntitlements, PLAN_ERROR } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

const TTL_MS = 15 * 60 * 1000;

/** Panel: yeni 6 haneli köprü eşleştirme kodu (15 dk). */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const entitlements = await getEntitlements(supabase, user.id);
  if (!entitlements.cloudMonitoring) {
    return NextResponse.json(
      { error: cloudRequiredMessage(), code: PLAN_ERROR.cloudRequired },
      { status: 402 }
    );
  }

  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  const admin = createAdminClient();

  await admin
    .from("bridge_pairing_codes")
    .delete()
    .eq("user_id", user.id)
    .is("used_at", null)
    .lt("expires_at", new Date().toISOString());

  const { error } = await admin.from("bridge_pairing_codes").insert({
    user_id: user.id,
    code_hash: hashPairingCode(code),
    expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

  return NextResponse.json({
    code,
    expiresAt,
    pairUrl: `${siteUrl}/api/bridge/pair`,
  });
}
