/**
 * Vercel service binding (vercel.json → app → printflow-bridge).
 * Yalnızca sunucu fonksiyonlarında runtime'da dolar; middleware/build'de kullanılamaz.
 */
export function getBridgeServiceBase(): string | undefined {
  const raw = process.env.PRINTFLOW_BRIDGE_SERVICE_URL?.trim();
  if (!raw) return undefined;
  return raw.replace(/\/$/, "");
}

/** Dahili köprü servisine göreli yol (binding yoksa undefined). */
export function bridgeServiceUrl(path: string): URL | undefined {
  const base = getBridgeServiceBase();
  if (!base) return undefined;
  return new URL(path.startsWith("/") ? path : `/${path}`, base);
}
