import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "@/lib/integration-crypto";
import type { IntegrationAccountRow } from "./sync";
import type { VendorCredentials } from "./types";

/** Sunucu tarafı: DB'deki şifreli alanları çözüp adaptöre verir. */
export function resolveVendorCredentials(account: IntegrationAccountRow): VendorCredentials {
  return {
    vendor: account.vendor,
    apiKey: decryptIntegrationSecret(account.api_key),
    accessToken: decryptIntegrationSecret(account.access_token),
    refreshToken: decryptIntegrationSecret(account.refresh_token),
  };
}

export function secretsForStorage(fields: {
  api_key?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
}): {
  api_key: string | null;
  access_token: string | null;
  refresh_token: string | null;
} {
  const enc = (v: string | null | undefined) => {
    const t = v?.trim();
    if (!t) return null;
    return encryptIntegrationSecret(t);
  };

  return {
    api_key: enc(fields.api_key),
    access_token: enc(fields.access_token),
    refresh_token: enc(fields.refresh_token),
  };
}
