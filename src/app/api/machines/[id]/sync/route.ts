import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncMachineById } from "@/lib/printer-monitoring/sync";
import { isLanMonitoringEnabled } from "@/lib/printer-monitoring/lan";
import {
  CLOUD_ACCOUNT_SELECT,
  normalizeIntegrationAccount,
  syncCloudLink,
  type MachineCloudLinkRow,
} from "@/lib/printer-cloud/sync";
import { cloudRequiredMessage, getEntitlements, PLAN_ERROR } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id: machineId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
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

  const { data: cloudLink } = await supabase
    .from("machine_cloud_links")
    .select(
      `id, machine_id, user_id, integration_account_id, external_device_id, enabled,
       integration_account:printer_integration_accounts(${CLOUD_ACCOUNT_SELECT})`
    )
    .eq("machine_id", machineId)
    .eq("user_id", user.id)
    .eq("enabled", true)
    .maybeSingle();

  const cloudAccount = normalizeIntegrationAccount(cloudLink?.integration_account);
  if (cloudLink && cloudAccount) {
    const entitlements = await getEntitlements(supabase, user.id);
    if (!entitlements.cloudMonitoring) {
      return NextResponse.json(
        { ok: false, error: cloudRequiredMessage(), code: PLAN_ERROR.cloudRequired },
        { status: 402 }
      );
    }
    if (cloudAccount.status === "disconnected") {
      return NextResponse.json(
        { ok: false, error: "Hesap bağlantısı kesilmiş — yeniden bağlayın", reconnect: true },
        { status: 409 }
      );
    }

    const result = await syncCloudLink(supabase, cloudLink as MachineCloudLinkRow, cloudAccount);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    if (result.authError) {
      return NextResponse.json(
        { ok: false, error: result.telemetry.errorMessage, reconnect: true },
        { status: 409 }
      );
    }
    return NextResponse.json({
      ok: true,
      telemetry: result.telemetry,
      unreachable: result.unreachable === true,
    });
  }

  const { data: bridgeBinding } = await supabase
    .from("bridge_machine_bindings")
    .select("id, last_push_at")
    .eq("machine_id", machineId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (bridgeBinding) {
    return NextResponse.json({
      ok: true,
      fromBridge: true,
      message: "Durum atölye köprüsünden otomatik güncellenir.",
      lastPushAt: bridgeBinding.last_push_at,
    });
  }

  if (!isLanMonitoringEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Bu makine canlı takibe bağlı değil." },
      { status: 400 }
    );
  }

  const result = await syncMachineById(supabase, machineId, user.id);
  if (!result.ok) {
    const isMissing = result.error.includes("tanımlı değil");
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: isMissing ? 400 : 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    telemetry: result.telemetry,
    unreachable: "unreachable" in result && result.unreachable === true,
  });
}
