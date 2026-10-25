import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isProductionRuntime, requireIntegrationEncryptionKey } from "@/lib/integration-crypto";
import { secretsForStorage } from "@/lib/printer-cloud/credentials";
import { bambuLoginWithPassword, bambuListDevices } from "@/lib/printer-cloud/bambu-client";
import {
  crealityLoginWithPassword,
  crealityListDevices,
} from "@/lib/printer-cloud/creality-client";
import { vendorSupportsAccountLogin } from "@/lib/printer-cloud/connect-mode";
import { isCloudAuthError } from "@/lib/printer-cloud/errors";
import { isCloudMockEnabled } from "@/lib/printer-cloud/mock";
import { isPrinterVendor, VENDOR_LABELS, VENDOR_LIVE } from "@/lib/printer-cloud/types";
import { cloudRequiredMessage, getEntitlements, PLAN_ERROR } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

const PUBLIC_ACCOUNT_FIELDS =
  "id, user_id, vendor, display_name, status, last_sync_at, created_at, updated_at";

export async function POST(request: NextRequest) {
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

  let body: {
    vendor?: string;
    email?: string;
    password?: string;
    verificationCode?: string;
    reconnectAccountId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const vendor = body.vendor ?? "";
  if (!isPrinterVendor(vendor) || !VENDOR_LIVE[vendor] || !vendorSupportsAccountLogin(vendor)) {
    return NextResponse.json({ error: "Bu üretici hesap girişi ile bağlanamaz" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "E-posta ve şifre gerekli" }, { status: 400 });
  }
  if (email.length > 200 || password.length > 200) {
    return NextResponse.json({ error: "Geçersiz giriş bilgisi" }, { status: 400 });
  }

  if (isProductionRuntime() && !isCloudMockEnabled()) {
    requireIntegrationEncryptionKey();
  }

  let accessToken: string;
  let refreshToken: string | null;

  try {
    if (vendor === "bambu") {
      const tokens = await bambuLoginWithPassword({
        account: email,
        password,
        verificationCode: body.verificationCode,
      });
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
      await bambuListDevices({ accessToken, apiKey: null });
    } else {
      const session = await crealityLoginWithPassword({ email, password });
      accessToken = session.accessToken;
      refreshToken = session.userId;
      await crealityListDevices({
        accessToken,
        refreshToken,
        apiKey: null,
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Giriş başarısız";
    if (/doğrulama kodu/i.test(message)) {
      return NextResponse.json({ error: message, needsVerification: true }, { status: 409 });
    }
    const status = isCloudAuthError(e) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }

  const stored = secretsForStorage({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  const displayName = `${VENDOR_LABELS[vendor]} · ${email}`;
  const reconnectId =
    body.reconnectAccountId && /^[0-9a-f-]{36}$/i.test(body.reconnectAccountId)
      ? body.reconnectAccountId
      : null;

  let existingId = reconnectId;
  if (!existingId) {
    const { data: existing } = await supabase
      .from("printer_integration_accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("vendor", vendor)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    existingId = existing?.id ?? null;
  }

  const { data: account, error } = existingId
    ? await supabase
        .from("printer_integration_accounts")
        .update({
          access_token: stored.access_token,
          refresh_token: stored.refresh_token,
          display_name: displayName,
          status: "active",
        })
        .eq("id", existingId)
        .eq("user_id", user.id)
        .eq("vendor", vendor)
        .select(PUBLIC_ACCOUNT_FIELDS)
        .single()
    : await supabase
        .from("printer_integration_accounts")
        .insert({
          user_id: user.id,
          vendor,
          display_name: displayName,
          api_key: null,
          access_token: stored.access_token,
          refresh_token: stored.refresh_token,
          status: "active",
        })
        .select(PUBLIC_ACCOUNT_FIELDS)
        .single();

  if (error || !account) {
    const planBlocked = error?.hint === PLAN_ERROR.cloudRequired;
    return NextResponse.json(
      { error: error?.message ?? "Hesap kaydedilemedi", code: planBlocked ? PLAN_ERROR.cloudRequired : undefined },
      { status: planBlocked ? 402 : 500 }
    );
  }

  return NextResponse.json({ account });
}
