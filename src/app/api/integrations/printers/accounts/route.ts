import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { secretsForStorage } from "@/lib/printer-cloud/credentials";
import { authModeFromConnect, getVendorConnectMode } from "@/lib/printer-cloud/connect-mode";
import { isCloudMockEnabled } from "@/lib/printer-cloud/mock";
import {
  isPrinterVendor,
  VENDOR_LABELS,
  VENDOR_PRIMARY_TILES,
  type VendorProviderInfo,
} from "@/lib/printer-cloud/types";
import { cloudRequiredMessage, getEntitlements, PLAN_ERROR } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

const PUBLIC_ACCOUNT_FIELDS =
  "id, user_id, vendor, display_name, status, last_sync_at, created_at, updated_at";

function providerInfo(): VendorProviderInfo[] {
  return VENDOR_PRIMARY_TILES.map((vendor) => {
    const mode = getVendorConnectMode(vendor);
    const available = mode !== "unavailable";
    return {
      vendor,
      label: VENDOR_LABELS[vendor],
      available,
      comingSoon: !available,
      auth: authModeFromConnect(mode),
    };
  });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("printer_integration_accounts")
    .select(PUBLIC_ACCOUNT_FIELDS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    accounts: data ?? [],
    providers: providerInfo(),
    mock: isCloudMockEnabled(),
  });
}

/**
 * Müşteri hesapları yalnızca OAuth callback ile oluşur.
 * Bu uç yalnızca yerel geliştirmede (PRINTER_CLOUD_MOCK) sahte hesap açar.
 */
export async function POST(request: NextRequest) {
  if (!isCloudMockEnabled()) {
    return NextResponse.json(
      { error: "Hesap bağlamak için \"Hesabımla bağlan\" adımını kullanın." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  let body: { vendor?: string; display_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const vendor = body.vendor ?? "";
  if (!isPrinterVendor(vendor)) {
    return NextResponse.json({ error: "Geçersiz üretici" }, { status: 400 });
  }

  const entitlements = await getEntitlements(supabase, user.id);
  if (!entitlements.cloudMonitoring) {
    return NextResponse.json(
      { error: cloudRequiredMessage(), code: PLAN_ERROR.cloudRequired },
      { status: 402 }
    );
  }

  const stored = secretsForStorage({
    access_token: "mock",
    refresh_token: vendor === "creality" ? "mock-user" : "mock",
  });

  const { data: account, error } = await supabase
    .from("printer_integration_accounts")
    .insert({
      user_id: user.id,
      vendor,
      display_name: body.display_name?.trim() || `${VENDOR_LABELS[vendor]} (demo)`,
      api_key: null,
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
      status: "active",
    })
    .select(PUBLIC_ACCOUNT_FIELDS)
    .single();

  if (error) {
    const planBlocked = error.hint === PLAN_ERROR.cloudRequired;
    return NextResponse.json(
      { error: error.message, code: planBlocked ? PLAN_ERROR.cloudRequired : undefined },
      { status: planBlocked ? 402 : 500 }
    );
  }

  return NextResponse.json({ account, mock: true });
}
