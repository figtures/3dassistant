"use client";

import Link from "next/link";
import { useEntitlements } from "@/hooks/use-entitlements";
import { TRIAL_URGENT_DAYS, trialDaysRemaining } from "@/lib/billing/trial";
import { cn } from "@/lib/utils";

export function TrialIndicator() {
  const { data: ent } = useEntitlements();
  const sub = ent?.entitlements.subscription;
  if (!sub || sub.status !== "trialing") return null;

  const days = trialDaysRemaining(sub.currentPeriodEnd);
  if (days == null) return null;

  const urgent = days <= TRIAL_URGENT_DAYS;

  return (
    <Link
      href="/settings/billing"
      className={cn(
        "hidden shrink-0 rounded-full border px-3 py-1 text-xs font-medium tabular-nums sm:inline-flex",
        urgent
          ? "border-warning/50 bg-warning/15 text-warning-foreground"
          : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
      )}
      aria-label={
        days === 0
          ? "Deneme süreniz bugün bitiyor, abonelik sayfasına git"
          : `Deneme sürenizde ${days} gün kaldı, abonelik sayfasına git`
      }
    >
      {days === 0 ? "Deneme bugün bitiyor" : `Deneme: ${days} gün`}
    </Link>
  );
}
