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

export function isAuthRateLimitError(error: { status?: number; code?: string } | null): boolean {
  return error?.status === 429 || error?.code === "over_request_rate_limit";
}
