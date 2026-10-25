import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEntitledStatus, planKeyForPriceId } from "@/lib/billing/plans";
import {
  isStaleUpdate,
  normalizeSubscription,
  verifyPaddleSignature,
  type PaddleSubscriptionData,
} from "@/lib/billing/webhook";

export const dynamic = "force-dynamic";

type PaddleEvent = {
  event_id?: string;
  event_type?: string;
  data?: unknown;
};

export async function POST(request: NextRequest) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[webhooks/paddle] PADDLE_WEBHOOK_SECRET tanımlı değil");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const valid = verifyPaddleSignature({
    rawBody,
    header: request.headers.get("paddle-signature"),
    secret,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PaddleEvent;
  try {
    event = JSON.parse(rawBody) as PaddleEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!event.event_id || !event.event_type) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  if (!event.event_type.startsWith("subscription.")) {
    return NextResponse.json({ ok: true, ignored: event.event_type });
  }

  const supabase = createAdminClient();

  const { data: seen } = await supabase
    .from("billing_webhook_events")
    .select("event_id")
    .eq("event_id", event.event_id)
    .maybeSingle();
  if (seen) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const normalized = normalizeSubscription(
    (event.data ?? {}) as PaddleSubscriptionData,
    planKeyForPriceId
  );
  if (!normalized.ok) {
    // Bilinmeyen fiyat/durum: tekrar denemek sonucu değiştirmez, kaydedip 200 dönüyoruz.
    console.error("[webhooks/paddle] skipped", event.event_id, normalized.reason);
    await supabase
      .from("billing_webhook_events")
      .insert({ event_id: event.event_id, event_type: event.event_type });
    return NextResponse.json({ ok: true, skipped: normalized.reason });
  }

  const sub = normalized.value;

  let userId = sub.custom_user_id;
  if (!userId) {
    const { data: customer } = await supabase
      .from("billing_customers")
      .select("user_id")
      .eq("paddle_customer_id", sub.paddle_customer_id)
      .maybeSingle();
    userId = customer?.user_id ?? null;
  }
  if (!userId) {
    // Eşleşme yoksa 500 dönüp Paddle'ın tekrar denemesine izin veriyoruz.
    console.error("[webhooks/paddle] user not resolved", event.event_id, sub.paddle_subscription_id);
    return NextResponse.json({ error: "User not resolved" }, { status: 500 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("subscriptions")
    .select("paddle_subscription_id, status, paddle_updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) {
    console.error("[webhooks/paddle] read failed", existingError.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const sameSubscription = existing?.paddle_subscription_id === sub.paddle_subscription_id;
  const skip =
    existing &&
    ((sameSubscription && isStaleUpdate(existing.paddle_updated_at, sub.paddle_updated_at)) ||
      // Kullanıcının hâlâ geçerli başka bir aboneliği varsa eski aboneliğin iptali onu ezmez
      (!sameSubscription && isEntitledStatus(existing.status) && !isEntitledStatus(sub.status)));

  if (!skip) {
    const { error: customerError } = await supabase
      .from("billing_customers")
      .upsert(
        { user_id: userId, paddle_customer_id: sub.paddle_customer_id },
        { onConflict: "user_id" }
      );
    if (customerError) {
      console.error("[webhooks/paddle] customer upsert failed", customerError.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const row: Record<string, unknown> = { ...sub, user_id: userId };
    delete row.custom_user_id;
    const { error: upsertError } = await supabase
      .from("subscriptions")
      .upsert(row, { onConflict: "user_id" });
    if (upsertError) {
      console.error("[webhooks/paddle] subscription upsert failed", upsertError.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
  }

  await supabase
    .from("billing_webhook_events")
    .insert({ event_id: event.event_id, event_type: event.event_type });

  return NextResponse.json({ ok: true, applied: !skip });
}
