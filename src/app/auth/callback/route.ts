import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function shouldRedirectNewUserToOnboarding(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  userMetadata: Record<string, unknown> | undefined
): Promise<boolean> {
  if (userMetadata?.onboarding != null && typeof userMetadata.onboarding === "object") {
    return false;
  }

  const [machines, materials, jobs, customers] = await Promise.all([
    supabase.from("machines").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("materials").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const hasData =
    (machines.count ?? 0) > 0 ||
    (materials.count ?? 0) > 0 ||
    (jobs.count ?? 0) > 0 ||
    (customers.count ?? 0) > 0;

  return !hasData;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (
        user &&
        (await shouldRedirectNewUserToOnboarding(
          supabase,
          user.id,
          user.user_metadata as Record<string, unknown> | undefined
        ))
      ) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
