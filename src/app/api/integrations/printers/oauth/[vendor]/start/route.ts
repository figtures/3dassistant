import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCloudMockEnabled, isPrinterVendor } from "@/lib/printer-cloud";
import { buildAuthorizeUrl } from "@/lib/printer-cloud/oauth/exchange";
import {
  codeChallengeFromVerifier,
  generateCodeVerifier,
  generateOAuthState,
} from "@/lib/printer-cloud/oauth/pkce";
import {
  getVendorOAuthConfig,
  oauthRedirectUri,
  vendorUsesOAuth,
} from "@/lib/printer-cloud/oauth/config";
import {
  OAUTH_STATE_COOKIE,
  oauthStateCookieOptions,
  serializeOAuthState,
} from "@/lib/printer-cloud/oauth/state-cookie";
import { getServerSiteUrl } from "@/lib/site-url-server";
import { getEntitlements } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ vendor: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { vendor: vendorParam } = await context.params;
  if (!isPrinterVendor(vendorParam) || !vendorUsesOAuth(vendorParam)) {
    return NextResponse.json({ error: "Geçersiz üretici" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", getServerSiteUrl(request)));
  }

  const siteUrl = getServerSiteUrl(request);
  const entitlements = await getEntitlements(supabase, user.id);
  if (!entitlements.cloudMonitoring) {
    return NextResponse.redirect(new URL("/billing?reason=cloud", siteUrl));
  }

  const mockMode = isCloudMockEnabled();
  const redirectUri = oauthRedirectUri(vendorParam, siteUrl);
  const reconnectParam = new URL(request.url).searchParams.get("reconnect");
  const reconnectAccountId =
    reconnectParam && /^[0-9a-f-]{36}$/i.test(reconnectParam) ? reconnectParam : undefined;

  if (mockMode) {
    const state = generateOAuthState();
    const codeVerifier = generateCodeVerifier();
    const response = NextResponse.redirect(
      `${redirectUri}?code=mock&state=${encodeURIComponent(state)}`
    );
    response.cookies.set(
      OAUTH_STATE_COOKIE,
      serializeOAuthState({
        vendor: vendorParam,
        state,
        codeVerifier,
        reconnectAccountId,
      }),
      oauthStateCookieOptions()
    );
    return response;
  }

  const config = getVendorOAuthConfig(vendorParam);
  if (!config.enabled) {
    if (vendorParam === "bambu") {
      console.error("[oauth/start] BAMBU_OAUTH_CLIENT_ID tanımlı değil");
    }
    const reason = config.unavailableReason ?? "Bu üretici ile bağlantı şu an kullanılamıyor.";
    return NextResponse.redirect(
      `${siteUrl}/machines?oauth_error=${encodeURIComponent(reason)}`
    );
  }

  const state = generateOAuthState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = codeChallengeFromVerifier(codeVerifier);
  const authorizeUrl = buildAuthorizeUrl(config, {
    redirectUri,
    state,
    codeChallenge,
  });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(
    OAUTH_STATE_COOKIE,
    serializeOAuthState({
      vendor: vendorParam,
      state,
      codeVerifier,
      reconnectAccountId,
    }),
    oauthStateCookieOptions()
  );
  return response;
}
