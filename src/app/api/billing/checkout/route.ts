import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionRow } from "@/lib/billing/entitlements";
import {
  changeSubscriptionPrice,
  createCheckoutTransaction,
  isPaddleConfigured,
  PaddleApiError,
} from "@/lib/billing/paddle";
import {
  isEntitledStatus,
  isPaidPlanKey,
  PLANS,
  priceIdForPlan,
  type BillingInterval,
} from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  if (!isPaddleConfigured()) {
    return NextResponse.json(
      { error: "Online ödeme şu an kullanılamıyor. Lütfen destek ile iletişime geçin." },
      { status: 503 }
    );
  }

  let body: { plan?: unknown; interval?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  if (!isPaidPlanKey(body.plan)) {
    return NextResponse.json({ error: "Geçersiz plan" }, { status: 400 });
  }
  const plan = body.plan;
  const interval: BillingInterval = body.interval === "year" ? "year" : "month";
  const priceId = priceIdForPlan(plan, interval);
  if (!priceId) {
    return NextResponse.json({ error: "Bu plan şu an satın alınamıyor" }, { status: 503 });
  }

  try {
    const existing = await getSubscriptionRow(supabase, user.id);
    const hasLiveSubscription =
      existing &&
      isEntitledStatus(existing.status) &&
      !existing.paddle_subscription_id.startsWith("dev_");

    if (hasLiveSubscription) {
      if (existing.plan_key === plan) {
        return NextResponse.json({ error: "Zaten bu plandasınız" }, { status: 400 });
      }
      await changeSubscriptionPrice(existing.paddle_subscription_id, priceId);
      return NextResponse.json({ mode: "updated", plan, planName: PLANS[plan].name });
    }

    const { data: customer } = await supabase
      .from("billing_customers")
      .select("paddle_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const transaction = await createCheckoutTransaction({
      priceId,
      userId: user.id,
      customerId: customer?.paddle_customer_id ?? null,
    });
    return NextResponse.json({ mode: "checkout", transactionId: transaction.id });
  } catch (e) {
    if (e instanceof PaddleApiError) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    console.error("[billing/checkout]", e);
    return NextResponse.json({ error: "Ödeme başlatılamadı" }, { status: 500 });
  }
}
