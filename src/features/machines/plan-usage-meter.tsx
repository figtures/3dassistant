import Link from "next/link";
import type { EntitlementsResponse } from "@/hooks/use-entitlements";
import { openUpgradePromptFromPlanError } from "@/lib/billing/handle-plan-error";
import { cn } from "@/lib/utils";

const USAGE_WARN_RATIO = 0.8;

export type PlanUsageMeterProps = {
  ent: EntitlementsResponse;
  className?: string;
};

export function PlanUsageMeter({ ent, className }: PlanUsageMeterProps) {
  const { usage, entitlements } = ent;
  const max = entitlements.maxMachines;
  const used = usage.machines;
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  const atLimit = used >= max;
  const nearLimit = max > 0 && used / max >= USAGE_WARN_RATIO && !atLimit;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-3",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          <span className="tabular-nums font-medium text-foreground">
            {used} / {max}
          </span>{" "}
          makine · {entitlements.planName} planı
        </span>
        {atLimit || nearLimit ? (
          atLimit ? (
            <Link
              href="/billing"
              className="text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              Planı yükselt
            </Link>
          ) : (
            <button
              type="button"
              onClick={() =>
                openUpgradePromptFromPlanError(
                  {
                    error: `Makine kotanızın %${Math.round((used / max) * 100)}'ini kullanıyorsunuz.`,
                  },
                  "machine_slots"
                )
              }
              className="text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              Kotayı kontrol et
            </button>
          )
        ) : null}
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label="Plan makine kullanımı"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            atLimit || nearLimit ? "bg-warning" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
