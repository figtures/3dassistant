"use client";

import { useEntitlements } from "@/hooks/use-entitlements";
import { openUpgradePromptFromPlanError } from "@/lib/billing/handle-plan-error";
import { cn } from "@/lib/utils";

const USAGE_WARN_RATIO = 0.8;

export function SidebarPlanCard({ collapsed }: { collapsed: boolean }) {
  const { data: ent } = useEntitlements();
  if (!ent || collapsed) return null;

  const { usage, entitlements } = ent;
  const max = entitlements.maxMachines;
  const used = usage.machines;
  const pct = max > 0 ? used / max : 0;
  const nearLimit = pct >= USAGE_WARN_RATIO && used < max;
  const atLimit = used >= max;

  if (!nearLimit && !atLimit) return null;

  return (
    <div className="border-t border-sidebar-border px-3 py-3">
      <button
        type="button"
        onClick={() =>
          openUpgradePromptFromPlanError(
            {
              error: atLimit
                ? `Planınız ${max} makine ile sınırlı.`
                : `Makine kotanızın %${Math.round(pct * 100)}'ini kullanıyorsunuz.`,
            },
            "machine_slots"
          )
        }
        className={cn(
          "w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors",
          "border-warning/30 bg-[color-mix(in_oklab,var(--state-paused)_10%,transparent)]",
          "hover:bg-[color-mix(in_oklab,var(--state-paused)_16%,transparent)]",
          "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        )}
      >
        <p className="font-medium text-foreground">
          {atLimit ? "Makine limiti doldu" : "Makine kotası dolmak üzere"}
        </p>
        <p className="mt-0.5 text-muted-foreground">
          {used} / {max} · {entitlements.planName}
        </p>
      </button>
    </div>
  );
}
