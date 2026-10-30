import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  hasSupabaseAuthCookie,
  isAuthRateLimitError,
  isRscOrPrefetchRequest,
} from "@/lib/supabase/auth-cookies";

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/legal")
  );
}

function isSessionEntryPage(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth/callback")
  );
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // API rotaları kendi kimlik doğrulamasını yapar.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next({ request });
  }

  // RSC/prefetch: Supabase Auth API'sine tekrar tekrar gitme (429 tetikler).
  if (isRscOrPrefetchRequest(request)) {
    return NextResponse.next({ request });
  }

  const isPublicPage = isPublicPath(pathname);
  const hasAuthCookie = hasSupabaseAuthCookie(request);

  // Oturum çerezi yok — yalnızca yönlendirme mantığı, ağ çağrısı yok.
  if (!hasAuthCookie) {
    if (!isPublicPage && pathname !== "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (isAuthRateLimitError(error)) {
    return supabaseResponse;
  }

  if (!user && !isPublicPage && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isSessionEntryPage(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
