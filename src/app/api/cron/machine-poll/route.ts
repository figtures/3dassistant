import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyTelemetryToMachine,
  pullTelemetryForConnection,
  type MachineConnectionRow,
} from "@/lib/printer-monitoring/sync";
import { isLanMonitoringEnabled } from "@/lib/printer-monitoring/lan";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isLanMonitoringEnabled()) {
    return NextResponse.json({ ok: true, skipped: "lan_disabled" });
  }

  try {
    const supabase = createAdminClient();

    const { data: connections, error } = await supabase
      .from("machine_connections")
      .select("*")
      .eq("enabled", true)
      .neq("adapter_type", "manual");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const conn of connections ?? []) {
      const pulled = await pullTelemetryForConnection(conn as MachineConnectionRow);
      const result = await applyTelemetryToMachine(
        supabase,
        conn.machine_id,
        pulled,
        conn.user_id
      );
      if (result.ok) synced++;
      else {
        failed++;
        errors.push(`${conn.machine_id}: ${result.error}`);
      }
    }

    return NextResponse.json({
      ok: true,
      total: connections?.length ?? 0,
      synced,
      failed,
      errors,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[cron/machine-poll]", message, e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
