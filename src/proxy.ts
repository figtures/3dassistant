import { type NextRequest, NextResponse } from "next/server";
import {
  parseUiParam,
  UI_COOKIE,
  UI_COOKIE_MAX_AGE,
} from "@/lib/flags/ui-version.shared";
import { updateSession } from "@/lib/supabase/middleware";

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie.name, cookie.value);
  }
}

export async function proxy(request: NextRequest) {
  const uiParam = request.nextUrl.searchParams.get("ui");
  const uiVersion = parseUiParam(uiParam);

  const sessionResponse = await updateSession(request);

  if (!uiVersion) {
    return sessionResponse;
  }

  const url = request.nextUrl.clone();
  url.searchParams.delete("ui");

  const redirect = NextResponse.redirect(url, 307);
  copyCookies(sessionResponse, redirect);
  redirect.cookies.set(UI_COOKIE, uiVersion, {
    maxAge: UI_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
