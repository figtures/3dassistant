import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bridgeFromBearer } from "@/lib/bridge/auth";
import { parseBridgeTelemetry } from "@/lib/bridge/telemetry";
import { applyTelemetryToMachine } from "@/lib/printer-monitoring/sync";

export const dynamic = "force-dynamic";

/** Köprü ajanı: makine telemetrisini buluta push eder. */
export async function POST(request: NextRequest) {
  const ctx = await bridgeFromBearer(request.headers.get("authorization"));
  if (!ctx) {
    return NextResponse.json({ error: "Geçersiz köprü jetonu" }, { status: 401 });
  }

  let body: { machineId?: string; telemetry?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const machineId = body.machineId?.trim();
  if (!machineId) {
    return NextResponse.json({ error: "machineId gerekli" }, { status: 400 });
  }

  const telemetry = parseBridgeTelemetry(body.telemetry);
  if (!telemetry) {
    return NextResponse.json({ error: "telemetry alanları geçersiz" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: binding } = await admin
    .from("bridge_machine_bindings")
    .select("id, machine_id")
    .eq("bridge_id", ctx.bridgeId)
    .eq("machine_id", machineId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!binding) {
    return NextResponse.json({ error: "Bu makine bu köprüye bağlı değil" }, { status: 403 });
  }

  const now = new Date().toISOString();
  await admin.from("workshop_bridges").update({ last_seen_at: now }).eq("id", ctx.bridgeId);
  await admin.from("bridge_machine_bindings").update({ last_push_at: now }).eq("id", binding.id);

  const result = await applyTelemetryToMachine(admin, machineId, telemetry, ctx.userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
