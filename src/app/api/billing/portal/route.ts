import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionRow } from "@/lib/billing/entitlements";
import { createPortalSession, isPaddleConfigured, PaddleApiError } from "@/lib/billing/paddle";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  if (!isPaddleConfigured()) {
    return NextResponse.json({ error: "Abonelik yönetimi şu an kullanılamıyor" }, { status: 503 });
  }

  const { data: customer } = await supabase
    .from("billing_customers")
    .select("paddle_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!customer?.paddle_customer_id) {
    return NextResponse.json({ error: "Henüz bir aboneliğiniz yok" }, { status: 404 });
  }

  try {
    const subscription = await getSubscriptionRow(supabase, user.id);
    const url = await createPortalSession(
      customer.paddle_customer_id,
      subscription ? [subscription.paddle_subscription_id] : []
    );
    return NextResponse.json({ url });
  } catch (e) {
    if (e instanceof PaddleApiError) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    console.error("[billing/portal]", e);
    return NextResponse.json({ error: "Yönetim sayfası açılamadı" }, { status: 500 });
  }
}
