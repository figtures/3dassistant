import { NextResponse } from "next/server";
import { isPaddleConfigured, listPrices, type PaddlePrice } from "@/lib/billing/paddle";
import { PAID_PLAN_KEYS, PLANS, priceIdForPlan } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

const INTERVAL_LABEL: Record<string, string> = {
  day: "gün",
  week: "hafta",
  month: "ay",
  year: "yıl",
};

function formatPrice(price: PaddlePrice): string {
  const amount = Number(price.unit_price.amount) / 100;
  const formatted = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: price.unit_price.currency_code,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
  const cycle = price.billing_cycle;
  if (!cycle) return formatted;
  const unit = INTERVAL_LABEL[cycle.interval] ?? cycle.interval;
  return cycle.frequency === 1 ? `${formatted} / ${unit}` : `${formatted} / ${cycle.frequency} ${unit}`;
}

export async function GET() {
  const configured = isPaddleConfigured();
  const priceIds = PAID_PLAN_KEYS.map((key) => priceIdForPlan(key)).filter(Boolean) as string[];

  let prices: PaddlePrice[] = [];
  if (configured && priceIds.length) {
    try {
      prices = await listPrices(priceIds);
    } catch {
      prices = [];
    }
  }

  const plans = PAID_PLAN_KEYS.map((key) => {
    const priceId = priceIdForPlan(key);
    const price = prices.find((p) => p.id === priceId);
    const plan = PLANS[key];
    return {
      key,
      name: plan.name,
      tagline: plan.tagline,
      features: plan.features,
      maxMachines: plan.maxMachines,
      cloudMonitoring: plan.cloudMonitoring,
      priceLabel: price ? formatPrice(price) : null,
      purchasable: configured && Boolean(priceId),
    };
  });

  return NextResponse.json({ plans, billingAvailable: configured });
}
