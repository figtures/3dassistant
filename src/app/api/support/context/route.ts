import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appBuildLabel } from "@/lib/support/admin";

export const dynamic = "force-dynamic";

/** Form için makine listesi ve son köprü tanılama paketi. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const { data: machines } = await supabase
    .from("machines")
    .select("id, name")
    .order("sort_order");

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: bundle } = await supabase
    .from("bridge_support_bundles")
    .select("bundle_code, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    appVersion: appBuildLabel(),
    machines: machines ?? [],
    recentBridgeBundle: bundle
      ? { code: bundle.bundle_code, createdAt: bundle.created_at }
      : null,
  });
}
