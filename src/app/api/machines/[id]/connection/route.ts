import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { testConnection } from "@/lib/printer-monitoring/sync";
import type { AdapterType } from "@/lib/printer-monitoring/types";
import { isLanMonitoringEnabled, LAN_DISABLED_MESSAGE } from "@/lib/printer-monitoring/lan";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const ADAPTERS: AdapterType[] = ["octoprint", "moonraker", "manual"];

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isLanMonitoringEnabled()) {
    return NextResponse.json({ error: LAN_DISABLED_MESSAGE }, { status: 404 });
  }
  const { id: machineId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  let body: {
    adapter_type?: AdapterType;
    base_url?: string;
    api_key?: string;
    test_only?: boolean;
    enabled?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const adapterType = body.adapter_type ?? "octoprint";
  if (!ADAPTERS.includes(adapterType)) {
    return NextResponse.json({ error: "Geçersiz adaptör" }, { status: 400 });
  }

  const { data: machine } = await supabase
    .from("machines")
    .select("id")
    .eq("id", machineId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!machine) {
    return NextResponse.json({ error: "Makine bulunamadı" }, { status: 404 });
  }

  const { data: existingConn } = await supabase
    .from("machine_connections")
    .select("id, api_key, base_url")
    .eq("machine_id", machineId)
    .maybeSingle();

  const baseUrl = body.base_url?.trim() || existingConn?.base_url || null;
  const apiKey =
    body.api_key?.trim() ||
    (existingConn?.api_key as string | null) ||
    null;

  const testResult = await testConnection(adapterType, baseUrl, apiKey);
  if (body.test_only) {
    if (!testResult.ok) {
      return NextResponse.json({ ok: false, error: testResult.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      message: "message" in testResult ? testResult.message : "Bağlantı başarılı",
      version: "version" in testResult ? testResult.version : undefined,
    });
  }

  if (adapterType !== "manual" && (!baseUrl || !apiKey)) {
    return NextResponse.json(
      { error: "OctoPrint için URL ve API anahtarı gerekli" },
      { status: 400 }
    );
  }

  if (!testResult.ok && adapterType === "octoprint") {
    return NextResponse.json(
      { error: testResult.error ?? "Bağlantı testi başarısız" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const row = {
    machine_id: machineId,
    user_id: user.id,
    adapter_type: adapterType,
    base_url: adapterType === "manual" ? null : baseUrl,
    api_key: adapterType === "manual" ? null : apiKey,
    enabled: body.enabled ?? true,
    last_test_ok: testResult.ok,
    last_test_at: now,
  };

  let dbError;
  if (existingConn) {
    ({ error: dbError } = await supabase
      .from("machine_connections")
      .update(row)
      .eq("id", existingConn.id));
  } else {
    ({ error: dbError } = await supabase.from("machine_connections").insert(row));
  }

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  if (adapterType === "manual") {
    await supabase
      .from("machines")
      .update({
        connection_status: "never",
        printer_state: "offline",
        job_name: null,
        progress_percent: null,
        print_time_seconds: null,
        error_message: null,
        telemetry_updated_at: now,
      })
      .eq("id", machineId);
  }

  return NextResponse.json({
    ok: true,
    last_test_ok: testResult.ok,
    adapter_type: adapterType,
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id: machineId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const { error } = await supabase
    .from("machine_connections")
    .delete()
    .eq("machine_id", machineId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("machines")
    .update({
      connection_status: "never",
      printer_state: "unknown",
      job_name: null,
      progress_percent: null,
      print_time_seconds: null,
      error_message: null,
      telemetry_raw: null,
      last_seen_at: null,
      telemetry_updated_at: new Date().toISOString(),
    })
    .eq("id", machineId)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
