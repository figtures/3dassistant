import type { PrinterVendor } from "../types";

export type VendorOAuthConfig = {
  vendor: PrinterVendor;
  enabled: boolean;
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string | null;
  scope: string | null;
  /** OAuth yok — kullanıcıya gösterilecek neden */
  unavailableReason?: string;
};

function env(key: string): string | null {
  const v = process.env[key]?.trim();
  return v || null;
}

export function oauthRedirectUri(vendor: PrinterVendor, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}/api/integrations/printers/oauth/${vendor}/callback`;
}

export function getVendorOAuthConfig(vendor: PrinterVendor): VendorOAuthConfig {
  if (vendor === "bambu") {
    const clientId = env("BAMBU_OAUTH_CLIENT_ID");
    const authorizeUrl =
      env("BAMBU_OAUTH_AUTHORIZE_URL") ?? "https://bambulab.com/api/v1/oauth/authorize";
    const tokenUrl =
      env("BAMBU_OAUTH_TOKEN_URL") ?? "https://bambulab.com/api/v1/oauth/token";

    return {
      vendor: "bambu",
      enabled: Boolean(clientId),
      authorizeUrl,
      tokenUrl,
      clientId: clientId ?? "",
      clientSecret: env("BAMBU_OAUTH_CLIENT_SECRET"),
      scope: env("BAMBU_OAUTH_SCOPE"),
      unavailableReason: clientId ? undefined : "Bambu onayı bekleniyor — bağlantı yakında açılıyor.",
    };
  }

  if (vendor === "creality") {
    const clientId = env("CREALITY_OAUTH_CLIENT_ID");
    const authorizeUrl = env("CREALITY_OAUTH_AUTHORIZE_URL");
    const tokenUrl = env("CREALITY_OAUTH_TOKEN_URL");

    const configured = Boolean(clientId && authorizeUrl && tokenUrl);
    return {
      vendor: "creality",
      enabled: configured,
      authorizeUrl: authorizeUrl ?? "",
      tokenUrl: tokenUrl ?? "",
      clientId: clientId ?? "",
      clientSecret: env("CREALITY_OAUTH_CLIENT_SECRET"),
      scope: env("CREALITY_OAUTH_SCOPE"),
      unavailableReason: configured
        ? undefined
        : "Creality partner OAuth yok — hesap girişi kullanılır.",
    };
  }

  return {
    vendor: "prusa",
    enabled: false,
    authorizeUrl: "",
    tokenUrl: "",
    clientId: "",
    clientSecret: null,
    scope: null,
    unavailableReason: "Prusa desteklenmiyor.",
  };
}

export function vendorUsesOAuth(vendor: PrinterVendor): boolean {
  return vendor === "bambu" || vendor === "creality";
}
