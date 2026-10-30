import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isProductionRuntime, requireIntegrationEncryptionKey } from "@/lib/integration-crypto";
import { secretsForStorage } from "@/lib/printer-cloud/credentials";
import {
  getVendorAdapter,
  isCloudMockEnabled,
  isPrinterVendor,
  VENDOR_LABELS,
} from "@/lib/printer-cloud";
import { exchangeAuthorizationCode } from "@/lib/printer-cloud/oauth/exchange";
import {
  getVendorOAuthConfig,
  oauthRedirectUri,
  vendorUsesOAuth,
} from "@/lib/printer-cloud/oauth/config";
import {
  OAUTH_STATE_COOKIE,
  oauthStateCookieOptions,
  parseOAuthState,
} from "@/lib/printer-cloud/oauth/state-cookie";
import { getServerSiteUrl } from "@/lib/site-url-server";
import { getEntitlements } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ vendor: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { vendor: vendorParam } = await context.params;
  const siteUrl = getServerSiteUrl(request);
  const machinesUrl = new URL("/machines", siteUrl);

  if (!isPrinterVendor(vendorParam) || !vendorUsesOAuth(vendorParam)) {
    machinesUrl.searchParams.set("oauth_error", "Geçersiz üretici");
    return NextResponse.redirect(machinesUrl);
  }

  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    machinesUrl.searchParams.set(
      "oauth_error",
      url.searchParams.get("error_description") ?? oauthError
    );
    return NextResponse.redirect(machinesUrl);
  }

  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  if (!code || !stateParam) {
    machinesUrl.searchParams.set("oauth_error", "OAuth yanıtı eksik");
    return NextResponse.redirect(machinesUrl);
  }

  const cookieStore = await cookies();
  const pending = parseOAuthState(cookieStore.get(OAUTH_STATE_COOKIE)?.value);

  if (!pending || pending.vendor !== vendorParam || pending.state !== stateParam) {
    machinesUrl.searchParams.set("oauth_error", "OAuth oturumu geçersiz — tekrar deneyin");
    return NextResponse.redirect(machinesUrl);
  }

  const successRedirect =
    pending.returnTo === "connect" ? new URL("/machines/connect", siteUrl) : machinesUrl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", siteUrl));
  }

  const entitlements = await getEntitlements(supabase, user.id);
  if (!entitlements.cloudMonitoring) {
    return NextResponse.redirect(new URL("/billing?reason=cloud", siteUrl));
  }

  const mockMode = isCloudMockEnabled();
  if (isProductionRuntime() && !mockMode) {
    requireIntegrationEncryptionKey();
  }

  let accessToken: string;
  let refreshToken: string | null = null;

  if (mockMode && code === "mock") {
    accessToken = "mock";
    refreshToken = "mock";
  } else {
    const config = getVendorOAuthConfig(vendorParam);
    if (!config.enabled) {
      machinesUrl.searchParams.set("oauth_error", "OAuth yapılandırması eksik");
      return NextResponse.redirect(machinesUrl);
    }
    try {
      const tokens = await exchangeAuthorizationCode(config, {
        code,
        redirectUri: oauthRedirectUri(vendorParam, siteUrl),
        codeVerifier: pending.codeVerifier,
      });
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
    } catch (e) {
      machinesUrl.searchParams.set(
        "oauth_error",
        e instanceof Error ? e.message : "Token alınamadı"
      );
      return NextResponse.redirect(machinesUrl);
    }
  }

  const vendor = vendorParam;
  const displayName = pending.displayName?.trim() || `${VENDOR_LABELS[vendor]} hesabı`;

  let deviceIds: string[];
  try {
    const adapter = getVendorAdapter(vendor);
    const devices = await adapter.listDevices({
      vendor,
      apiKey: null,
      accessToken,
      refreshToken,
    });
    deviceIds = devices.map((d) => d.id);
  } catch (e) {
    machinesUrl.searchParams.set(
      "oauth_error",
      e instanceof Error ? e.message : "Hesap doğrulanamadı"
    );
    return NextResponse.redirect(machinesUrl);
  }

  const stored = secretsForStorage({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  let existingAccountId = pending.reconnectAccountId ?? null;
  if (!existingAccountId && deviceIds.length > 0) {
    const { data: known } = await supabase
      .from("machine_cloud_links")
      .select("integration_account_id, integration_account:printer_integration_accounts!inner(vendor)")
      .eq("user_id", user.id)
      .eq("integration_account.vendor", vendor)
      .in("external_device_id", deviceIds)
      .limit(1)
      .maybeSingle();
    existingAccountId = (known?.integration_account_id as string | undefined) ?? null;
  }

  const { data: account, error } = existingAccountId
    ? await supabase
        .from("printer_integration_accounts")
        .update({
          access_token: stored.access_token,
          refresh_token: stored.refresh_token,
          status: "active",
        })
        .eq("id", existingAccountId)
        .eq("user_id", user.id)
        .eq("vendor", vendor)
        .select("id")
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
        .select("id")
        .single();

  if (error || !account) {
    machinesUrl.searchParams.set("oauth_error", error?.message ?? "Hesap kaydedilemedi");
    return NextResponse.redirect(machinesUrl);
  }

  if (pending.returnTo === "connect") {
    successRedirect.searchParams.set("connect", "resume");
  }
  successRedirect.searchParams.set("connected", "1");
  successRedirect.searchParams.set("account", account.id);
  successRedirect.searchParams.set("vendor", vendor);
  if (mockMode) {
    successRedirect.searchParams.set("mock", "1");
  }
  const response = NextResponse.redirect(successRedirect);
  response.cookies.set(OAUTH_STATE_COOKIE, "", { ...oauthStateCookieOptions(), maxAge: 0 });
  return response;
}
