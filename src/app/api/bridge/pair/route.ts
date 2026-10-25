import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateBridgeToken, hashPairingCode, hashToken } from "@/lib/bridge/crypto";
import { BRIDGE_VENDOR_LABELS, parseBridgeVendor } from "@/lib/bridge/vendors";
import { getEntitlements } from "@/lib/billing/entitlements";
import { bridgeFromBearer } from "@/lib/bridge/auth";
import { isValidLanHost } from "@/lib/bridge/lan-host";

export const dynamic = "force-dynamic";

type PairBody = {
  code?: string;
  machineName?: string;
  machineId?: string;
  agentVersion?: string;
  /** İkinci ve sonraki yazıcılar: mevcut köprü jetonu (yeni köprü oluşturulmaz). */
  bridgeToken?: string;
  printer?: {
    vendor?: string;
    serial?: string;
    host?: string;
    label?: string;
    /** Keşiften gelen model (ör. "P1S", "K2 Pro"); makine kartında model olarak kullanılır. */
    model?: string;
  };
};

/** Köprü ajanı: eşleştirme kodu + yazıcı bilgisi → kalıcı token + makine. */
export async function POST(request: NextRequest) {
  let body: PairBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const code = body.code?.trim().replace(/\s/g, "");
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "6 haneli eşleştirme kodu gerekli" }, { status: 400 });
  }

  const serial = body.printer?.serial?.trim();
  if (!serial) {
    return NextResponse.json({ error: "Yazıcı seri numarası gerekli" }, { status: 400 });
  }

  const rawVendor = body.printer?.vendor?.trim();
  const vendor = rawVendor ? parseBridgeVendor(rawVendor) : "bambu";
  if (!vendor) {
    return NextResponse.json(
      { error: `Desteklenmeyen yazıcı markası: ${rawVendor}` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const codeHash = hashPairingCode(code);
  const now = new Date().toISOString();

  const { data: pending } = await admin
    .from("bridge_pairing_codes")
    .select("id, user_id, used_at, bridge_id")
    .eq("code_hash", codeHash)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pending) {
    return NextResponse.json({ error: "Kod geçersiz veya süresi dolmuş" }, { status: 401 });
  }

  const reuseToken = body.bridgeToken?.trim();
  const existingBridge = reuseToken ? await bridgeFromBearer(`Bearer ${reuseToken}`) : null;
  if (reuseToken && (!existingBridge || existingBridge.userId !== pending.user_id)) {
    return NextResponse.json({ error: "Mevcut köprü jetonu geçersiz" }, { status: 401 });
  }

  // Keşif listesinden birden çok yazıcı seçildiğinde: kod süresi içinde, onu kullanan köprü tekrar kullanabilir.
  if (pending.used_at && (!existingBridge || existingBridge.bridgeId !== pending.bridge_id)) {
    return NextResponse.json({ error: "Kod geçersiz veya süresi dolmuş" }, { status: 401 });
  }

  const entitlements = await getEntitlements(admin, pending.user_id);
  if (!entitlements.cloudMonitoring) {
    return NextResponse.json({ error: "Plan canlı takip içermiyor" }, { status: 402 });
  }

  let bridgeToken: string;
  let bridgeId: string;

  if (reuseToken && existingBridge) {
    const existing = existingBridge;
    bridgeToken = reuseToken;
    bridgeId = existing.bridgeId;
    await admin
      .from("workshop_bridges")
      .update({
        agent_version: body.agentVersion?.trim() || null,
        last_seen_at: now,
      })
      .eq("id", bridgeId);
  } else {
    bridgeToken = generateBridgeToken();
    const { data: bridge, error: bridgeError } = await admin
      .from("workshop_bridges")
      .insert({
        user_id: pending.user_id,
        label: body.printer?.label?.trim() || "Atölye köprüsü",
        token_hash: hashToken(bridgeToken),
        agent_version: body.agentVersion?.trim() || null,
        last_seen_at: now,
      })
      .select("id")
      .single();

    if (bridgeError || !bridge) {
      return NextResponse.json({ error: bridgeError?.message ?? "Köprü oluşturulamadı" }, { status: 500 });
    }
    bridgeId = bridge.id;
  }

  const markCodeUsed = async () => {
    if (pending.used_at) return;
    await admin
      .from("bridge_pairing_codes")
      .update({ used_at: now, bridge_id: bridgeId })
      .eq("id", pending.id);
  };

  const rawHost = body.printer?.host?.trim();
  const lanHost = rawHost && isValidLanHost(rawHost) ? rawHost : null;
  const deviceLabel = body.printer?.label?.trim() || null;

  // Aynı yazıcı yeniden eşleştiriliyor (köprü yeniden kuruldu, IP değişti…): yeni makine açma.
  const { data: priorBinding } = await admin
    .from("bridge_machine_bindings")
    .select("id, machine_id")
    .eq("user_id", pending.user_id)
    .eq("vendor", vendor)
    .eq("device_serial", serial)
    .limit(1)
    .maybeSingle();

  if (priorBinding) {
    const { error: moveError } = await admin
      .from("bridge_machine_bindings")
      .update({ bridge_id: bridgeId, lan_host: lanHost, device_label: deviceLabel })
      .eq("id", priorBinding.id);
    if (moveError) {
      if (!reuseToken) await admin.from("workshop_bridges").delete().eq("id", bridgeId);
      return NextResponse.json({ error: moveError.message }, { status: 500 });
    }
    await markCodeUsed();
    return NextResponse.json({
      bridgeToken,
      bridgeId,
      machineId: priorBinding.machine_id,
      reused: true,
      message: "Yazıcı zaten bağlıydı; köprü bağlantısı güncellendi.",
    });
  }

  let machineId = body.machineId?.trim();
  if (machineId) {
    const { data: existing } = await admin
      .from("machines")
      .select("id")
      .eq("id", machineId)
      .eq("user_id", pending.user_id)
      .maybeSingle();
    if (!existing) machineId = undefined;
  }

  if (!machineId) {
    const defaultName = `${BRIDGE_VENDOR_LABELS[vendor]} ${serial.slice(-6)}`;
    const name = body.machineName?.trim() || body.printer?.label?.trim() || defaultName;
    const { count } = await admin
      .from("machines")
      .select("id", { count: "exact", head: true })
      .eq("user_id", pending.user_id);
    const { data: machine, error: machineError } = await admin
      .from("machines")
      .insert({
        user_id: pending.user_id,
        name,
        model: body.printer?.model?.trim() || body.printer?.label?.trim() || null,
        sort_order: count ?? 0,
      })
      .select("id")
      .single();

    if (machineError || !machine) {
      if (!reuseToken) await admin.from("workshop_bridges").delete().eq("id", bridgeId);
      const planBlocked = machineError?.hint === "PLAN_MACHINE_LIMIT";
      return NextResponse.json(
        { error: machineError?.message ?? "Makine oluşturulamadı" },
        { status: planBlocked ? 402 : 500 }
      );
    }
    machineId = machine.id;
  }

  const { error: bindError } = await admin.from("bridge_machine_bindings").insert({
    bridge_id: bridgeId,
    machine_id: machineId,
    user_id: pending.user_id,
    vendor,
    device_serial: serial,
    lan_host: lanHost,
    device_label: deviceLabel,
    last_push_at: null,
  });

  if (bindError) {
    if (!reuseToken) await admin.from("workshop_bridges").delete().eq("id", bridgeId);
    return NextResponse.json({ error: bindError.message }, { status: 500 });
  }

  await markCodeUsed();

  return NextResponse.json({
    bridgeToken,
    bridgeId,
    machineId,
    message: "Köprü bağlandı. Bu jetonu güvenli saklayın; tekrar gösterilmez.",
  });
}
