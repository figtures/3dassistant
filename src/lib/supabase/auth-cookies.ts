import type { NextRequest } from "next/server";

/** Supabase oturum çerezi var mı (ağ çağrısı yapmaz). */
export function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    ({ name }) => name.startsWith("sb-") && name.includes("-auth-token")
  );
}

/** RSC / prefetch istekleri — oturum yenilemesi belge navigasyonunda yeterli. */
export function isRscOrPrefetchRequest(request: NextRequest): boolean {
  return (
    request.headers.get("rsc") === "1" ||
    request.headers.get("next-router-prefetch") === "1"
  );
}

/** Tam sayfa yüklemesi (giriş sonrası /dashboard gibi) — proxy oturumu tazelemeli. */
export function isDocumentNavigation(request: NextRequest): boolean {
  const dest = request.headers.get("sec-fetch-dest");
  if (dest === "document") return true;
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

/**
 * Supabase getUser atlanabilir mi?
 * RSC/prefetch atlanır; belge navigasyonunda (Accept: text/html) tazeleme yapılır.
 */
export function shouldSkipSupabaseAuthRefresh(request: NextRequest): boolean {
  if (!isRscOrPrefetchRequest(request)) return false;
  return !isDocumentNavigation(request);
}

export function isAuthRateLimitError(error: { status?: number; code?: string } | null): boolean {
  return error?.status === 429 || error?.code === "over_request_rate_limit";
}
