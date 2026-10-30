import type { PrinterVendor } from "../types";

export const OAUTH_STATE_COOKIE = "pf_printer_oauth";

export type OAuthPendingState = {
  vendor: PrinterVendor;
  state: string;
  codeVerifier: string;
  displayName?: string;
  /** Doluysa callback yeni hesap açmaz, bu hesabın jetonlarını yeniler (RLS ile sahiplik). */
  reconnectAccountId?: string;
  /** OAuth sonrası yönlendirme: yazıcı bağlama sihirbazı. */
  returnTo?: "connect";
};

export function serializeOAuthState(payload: OAuthPendingState): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function parseOAuthState(raw: string | undefined | null): OAuthPendingState | null {
  if (!raw) return null;
  try {
    const json = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as OAuthPendingState;
    if (!json.vendor || !json.state || !json.codeVerifier) return null;
    return json;
  } catch {
    return null;
  }
}

export function oauthStateCookieOptions(maxAgeSeconds = 600) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
