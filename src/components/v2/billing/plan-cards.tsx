"use client";

import { Check, Loader2, Sparkles } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ds";
import type { BillingInterval } from "@/lib/billing/prices";
import type { PaidPlanKey, PlanKey } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export type PlanCardRow = {
  key: PlanKey;
  name: string;
  tagline: string;
  features: string[];
  cloudMonitoring: boolean;
  priceLabel: string;
  recommended: boolean;
  purchasable: boolean;
};

export type PlanCardsProps = {
  plans: PlanCardRow[];
  currentPlan: PlanKey;
  interval: BillingInterval;
  busyPlan: PaidPlanKey | null;
  checkoutPending: boolean;
  hasPaidSubscription: boolean;
  onSelectPlan: (plan: PaidPlanKey) => void;
};

export function PlanCards({
  plans,
  currentPlan,
  busyPlan,
  checkoutPending,
  hasPaidSubscription,
  onSelectPlan,
}: PlanCardsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => {
        const isCurrent = currentPlan === plan.key;
        const isPaid = plan.key !== "free";
        const paidKey = isPaid ? (plan.key as PaidPlanKey) : null;

        return (
          <Card
            key={plan.key}
            className={cn(
              "relative flex flex-col",
              isCurrent && "ring-2 ring-primary/40",
              plan.recommended && !isCurrent && "border-primary/30"
            )}
          >
            {plan.recommended ? (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge tone="primary" className="text-[10px] uppercase tracking-wide">
                  En popüler
                </Badge>
              </div>
            ) : null}
            <CardHeader className="space-y-1 pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                </div>
                {plan.cloudMonitoring ? (
                  <Badge tone="success" className="shrink-0 text-[10px]">
                    <Sparkles className="mr-1 h-3 w-3" aria-hidden />
                    Canlı takip
                  </Badge>
                ) : null}
              </div>
              <p className="pt-2 text-2xl font-semibold tabular-nums text-foreground">
                {plan.priceLabel}
              </p>
            </CardHeader>
            <CardContent className="flex-1 pt-0">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="pt-2">
              {isPaid && paidKey ? (
                <Button
                  className="w-full"
                  variant={isCurrent ? "secondary" : plan.recommended ? "primary" : "secondary"}
                  disabled={
                    isCurrent || !plan.purchasable || busyPlan !== null || checkoutPending
                  }
                  onClick={() => onSelectPlan(paidKey)}
                >
                  {busyPlan === paidKey ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : isCurrent ? (
                    "Mevcut plan"
                  ) : hasPaidSubscription && currentPlan !== "free" ? (
                    "Bu plana geç"
                  ) : (
                    "Abone ol"
                  )}
                </Button>
              ) : (
                <Button className="w-full" variant="secondary" disabled={isCurrent}>
                  {isCurrent ? "Mevcut plan" : "Ücretsiz başla"}
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
