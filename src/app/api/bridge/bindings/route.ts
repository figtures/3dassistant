import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bridgeFromBearer } from "@/lib/bridge/auth";
import { isValidLanHost } from "@/lib/bridge/lan-host";

export const dynamic = "force-dynamic";

/** Köprü: yazıcının LAN adresi değişti (DHCP) — köprü seri/MAC ile yeniden bulup bildirir. */
export async function PATCH(request: NextRequest) {
  const ctx = await bridgeFromBearer(request.headers.get("authorization"));
  if (!ctx) {
    return NextResponse.json({ error: "Geçersiz köprü jetonu" }, { status: 401 });
  }

  let body: { machineId?: string; host?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const machineId = body.machineId?.trim();
  const host = body.host?.trim();
  if (!machineId || !host) {
    return NextResponse.json({ error: "machineId ve host gerekli" }, { status: 400 });
  }
  if (!isValidLanHost(host)) {
    return NextResponse.json({ error: "Geçersiz host" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bridge_machine_bindings")
    .update({ lan_host: host })
    .eq("bridge_id", ctx.bridgeId)
    .eq("machine_id", machineId)
    .eq("user_id", ctx.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Bu makine bu köprüye bağlı değil" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
