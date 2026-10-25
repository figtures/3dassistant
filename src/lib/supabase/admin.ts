import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SERVICE_ROLE_MISSING_MESSAGE =
  "Sunucu yapılandırması eksik (SUPABASE_SERVICE_ROLE_KEY). Temel işlemler oturumunuzla çalışır; köprü paketi yükleme ve iç panel için service role gerekir.";

export function hasServiceRoleKey(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export function tryCreateAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createAdminClient(): SupabaseClient {
  const client = tryCreateAdminClient();
  if (!client) {
    throw new Error(SERVICE_ROLE_MISSING_MESSAGE);
  }
  return client;
}
