import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveVendorCredentials, secretsForStorage } from "./credentials";
import { isCloudAuthError } from "./errors";
import { getVendorAdapter } from "./index";
import { getVendorOAuthConfig, vendorUsesOAuth } from "./oauth/config";
import { refreshAccessToken } from "./oauth/exchange";
import type { CloudDevice, NormalizedTelemetry, PrinterVendor } from "./types";
import { applyTelemetryToMachine } from "@/lib/printer-monitoring/sync";

export type IntegrationAccountRow = {
  id: string;
  user_id: string;
  vendor: PrinterVendor;
  api_key: string | null;
  access_token: string | null;
  refresh_token: string | null;
  status: string;
};

export function normalizeIntegrationAccount(
  value: IntegrationAccountRow | IntegrationAccountRow[] | null | undefined
): IntegrationAccountRow | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export type MachineCloudLinkRow = {
  id: string;
  machine_id: string;
  user_id: string;
  integration_account_id: string;
  external_device_id: string;
  enabled: boolean;
};

export const CLOUD_ACCOUNT_SELECT = "id, user_id, vendor, api_key, access_token, refresh_token, status";

type PullResult =
  | NormalizedTelemetry
  | { unreachable: true; error: string; authError: boolean };

/**
 * Yetki hatasında (OAuth üreticileri) refresh token ile bir kez yeniler ve
 * yeni jetonları şifreli olarak kaydeder. `account` nesnesi yerinde güncellenir,
 * böylece aynı hesabın sonraki cihazları yeni jetonu kullanır.
 */
async function refreshAccountTokens(
  supabase: SupabaseClient,
  account: IntegrationAccountRow
): Promise<boolean> {
  if (!vendorUsesOAuth(account.vendor)) return false;
  const config = getVendorOAuthConfig(account.vendor);
  const { refreshToken } = resolveVendorCredentials(account);
  if (!config.enabled || !refreshToken) return false;

  const tokens = await refreshAccessToken(config, refreshToken);
  const stored = secretsForStorage({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
  const { error } = await supabase
    .from("printer_integration_accounts")
    .update({ access_token: stored.access_token, refresh_token: stored.refresh_token })
    .eq("id", account.id)
    .eq("user_id", account.user_id);
  if (error) throw new Error(error.message);

  account.access_token = stored.access_token;
  account.refresh_token = stored.refresh_token;
  return true;
}

export async function pullCloudTelemetry(
  supabase: SupabaseClient,
  account: IntegrationAccountRow,
  deviceId: string
): Promise<PullResult> {
  const adapter = getVendorAdapter(account.vendor);
  const attempt = () => adapter.fetchTelemetry(resolveVendorCredentials(account), deviceId);

  try {
    return await attempt();
  } catch (e) {
    if (isCloudAuthError(e)) {
      try {
        if (await refreshAccountTokens(supabase, account)) {
          return await attempt();
        }
      } catch (retryError) {
        return {
          unreachable: true,
          error: retryError instanceof Error ? retryError.message : "Bulut API hatası",
          authError: isCloudAuthError(retryError),
        };
      }
    }
    return {
      unreachable: true,
      error: e instanceof Error ? e.message : "Bulut API hatası",
      authError: isCloudAuthError(e),
    };
  }
}

/**
 * Kullanıcının bu üreticiye ait tüm hesaplarında zaten bağlı cihazlar. Aynı üretici hesabı
 * ikinci kez bağlanırsa (yeni hesap satırı) aynı yazıcı ikinci makine olarak eklenmez.
 */
export async function linkedDeviceIds(
  supabase: SupabaseClient,
  userId: string,
  vendor: PrinterVendor
): Promise<Set<string>> {
  const { data } = await supabase
    .from("machine_cloud_links")
    .select("external_device_id, integration_account:printer_integration_accounts!inner(vendor)")
    .eq("user_id", userId)
    .eq("integration_account.vendor", vendor);
  return new Set((data ?? []).map((l) => l.external_device_id as string));
}

export async function listAccountDevices(
  supabase: SupabaseClient,
  account: IntegrationAccountRow
): Promise<CloudDevice[]> {
  const adapter = getVendorAdapter(account.vendor);
  const attempt = () => adapter.listDevices(resolveVendorCredentials(account));
  try {
    return await attempt();
  } catch (e) {
    if (isCloudAuthError(e) && (await refreshAccountTokens(supabase, account))) {
      return attempt();
    }
    throw e;
  }
}

export type CloudLinkSyncResult =
  | { ok: true; telemetry: NormalizedTelemetry; unreachable?: true; authError: boolean }
  | { ok: false; error: string; authError: boolean };

/**
 * Tek bir bağlı yazıcıyı senkronlar. Hesap durumunu yalnızca
 * `updateAccount` açıkken günceller (cron hesap başına toplu günceller).
 * Cihazın çevrimdışı olması hesabı hataya düşürmez; yalnızca yetki hatası düşürür.
 */
export async function syncCloudLink(
  supabase: SupabaseClient,
  link: MachineCloudLinkRow,
  account: IntegrationAccountRow,
  options: { updateAccount?: boolean } = {}
): Promise<CloudLinkSyncResult> {
  const pulled = await pullCloudTelemetry(supabase, account, link.external_device_id);
  const authError = "unreachable" in pulled && pulled.authError;
  const telemetryInput =
    "unreachable" in pulled ? { unreachable: true as const, error: pulled.error } : pulled;

  const applied = await applyTelemetryToMachine(
    supabase,
    link.machine_id,
    telemetryInput,
    link.user_id
  );

  const now = new Date().toISOString();
  await supabase
    .from("machine_cloud_links")
    .update({ last_synced_at: now })
    .eq("id", link.id)
    .eq("user_id", link.user_id);

  if (options.updateAccount !== false) {
    const status = authError ? "error" : "unreachable" in pulled ? null : "active";
    await markAccountSynced(supabase, account, status);
  }

  if (!applied.ok) return { ok: false, error: applied.error, authError };
  return { ...applied, authError };
}

/** status=null: geçici hata, hesap kaydına dokunulmaz. */
export async function markAccountSynced(
  supabase: SupabaseClient,
  account: IntegrationAccountRow,
  status: "active" | "error" | null
) {
  if (!status) return;
  await supabase
    .from("printer_integration_accounts")
    .update({ status, last_sync_at: new Date().toISOString() })
    .eq("id", account.id)
    .eq("user_id", account.user_id);
}
