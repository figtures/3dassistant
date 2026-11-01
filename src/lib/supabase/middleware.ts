import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  hasSupabaseAuthCookie,
  isAuthRateLimitError,
  shouldSkipSupabaseAuthRefresh,
} from "@/lib/supabase/auth-cookies";
import type { User } from "@supabase/supabase-js";

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/legal") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/changelog") ||
    pathname === "/status"
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

  // Pazarlama ana sayfası — oturum yenilemesi gerekmez (proxy gecikmesini keser).
  if (pathname === "/") {
    return NextResponse.next({ request });
  }

  // RSC/prefetch (belge navigasyonu hariç): gereksiz getUser çağrılarını kes.
  if (shouldSkipSupabaseAuthRefresh(request)) {
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
    data: { user: userFromApi },
    error,
  } = await supabase.auth.getUser();

  let user: User | null = userFromApi;

  async function userFromSessionCookie(): Promise<User | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user ?? null;
  }

  if (isAuthRateLimitError(error) && !user) {
    user = await userFromSessionCookie();
  } else if (!user) {
    user = await userFromSessionCookie();
  }

  if (isAuthRateLimitError(error)) {
    if (user && isSessionEntryPage(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
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
