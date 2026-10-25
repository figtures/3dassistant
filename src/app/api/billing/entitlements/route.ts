import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements, getMachineUsage } from "@/lib/billing/entitlements";
import { isPaddleConfigured } from "@/lib/billing/paddle";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  try {
    const [entitlements, usage] = await Promise.all([
      getEntitlements(supabase, user.id),
      getMachineUsage(supabase, user.id),
    ]);
    return NextResponse.json({
      entitlements,
      usage,
      billingAvailable: isPaddleConfigured(),
    });
  } catch (e) {
    console.error("[billing/entitlements]", e);
    return NextResponse.json({ error: "Plan bilgisi alınamadı" }, { status: 500 });
  }
}
