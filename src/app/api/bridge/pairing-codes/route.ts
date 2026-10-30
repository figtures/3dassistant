import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePairingCode, hashPairingCode } from "@/lib/bridge/crypto";
import { cloudRequiredMessage, getEntitlements, PLAN_ERROR } from "@/lib/billing/entitlements";
import { requireWorkspaceSession } from "@/lib/workspace/active";
import { requireRole } from "@/lib/workspace/require-role";
import { getServerSiteUrl } from "@/lib/site-url-server";

export const dynamic = "force-dynamic";

const TTL_MS = 15 * 60 * 1000;

/** Panel: yeni 6 haneli köprü eşleştirme kodu (15 dk). */
export async function POST() {
  const supabase = await createClient();
  const session = await requireWorkspaceSession();
  if (!session.ok) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const auth = requireRole(session, "machines.manage");
  if (!auth.ok) return auth.response;
  const { workspaceId } = session;

  const entitlements = await getEntitlements(supabase, workspaceId);
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
    .eq("user_id", workspaceId)
    .is("used_at", null)
    .lt("expires_at", new Date().toISOString());

  const { error } = await admin.from("bridge_pairing_codes").insert({
    user_id: workspaceId,
    code_hash: hashPairingCode(code),
    expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const siteUrl = getServerSiteUrl();

  return NextResponse.json({
    code,
    expiresAt,
    pairUrl: `${siteUrl}/api/bridge/pair`,
  });
}
