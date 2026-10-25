import type { VendorOAuthConfig } from "./config";
import { CloudAuthError } from "../errors";

export type OAuthTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  raw: Record<string, unknown>;
};

const REQUEST_TIMEOUT_MS = 25_000;

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

export async function exchangeAuthorizationCode(
  config: VendorOAuthConfig,
  params: {
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", params.code);
  body.set("redirect_uri", params.redirectUri);
  body.set("code_verifier", params.codeVerifier);
  return requestToken(config, body);
}

export async function refreshAccessToken(
  config: VendorOAuthConfig,
  refreshToken: string
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);
  const tokens = await requestToken(config, body);
  return { ...tokens, refreshToken: tokens.refreshToken ?? refreshToken };
}

async function requestToken(
  config: VendorOAuthConfig,
  body: URLSearchParams
): Promise<OAuthTokenResponse> {
  body.set("client_id", config.clientId);
  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }
  if (config.scope) {
    body.set("scope", config.scope);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "PrintFlow/1.0",
      },
      body: body.toString(),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text().catch(() => "");
    let json: Record<string, unknown> = {};
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      /* ignore */
    }

    if (!res.ok) {
      const msg =
        pickString(json, ["error_description", "message", "error"]) ??
        `OAuth token hatası (${res.status})`;
      if (res.status === 400 || res.status === 401) throw new CloudAuthError(msg);
      throw new Error(msg);
    }

    let accessToken = pickString(json, ["access_token", "accessToken"]);
    if (!accessToken && json.data && typeof json.data === "object") {
      accessToken = pickString(json.data as Record<string, unknown>, [
        "access_token",
        "accessToken",
      ]);
    }
    if (!accessToken) {
      throw new Error("OAuth yanıtında access token bulunamadı");
    }

    const refreshToken = pickString(json, ["refresh_token", "refreshToken"]);
    const expiresIn = pickNumber(json, ["expires_in", "expiresIn"]);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      raw: json,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function buildAuthorizeUrl(
  config: VendorOAuthConfig,
  params: {
    redirectUri: string;
    state: string;
    codeChallenge: string;
  }
): string {
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (config.scope) {
    url.searchParams.set("scope", config.scope);
  }
  return url.toString();
}
