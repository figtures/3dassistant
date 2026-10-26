import { cn } from "@/lib/utils";
import type { UiMachineState } from "@/lib/machine-state";

export type LayerProgressProps = {
  value: number;
  state?: UiMachineState;
  segments?: number;
  className?: string;
};

export function LayerProgress({
  value,
  state = "printing",
  segments = 20,
  className,
}: LayerProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const filled = Math.round((clamped / 100) * segments);

  return (
    <div
      role="progressbar"
      aria-label="Baskı ilerlemesi"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn("flex gap-0.5", className)}
      data-live
    >
      {Array.from({ length: segments }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 flex-1 rounded-sm bg-muted",
            i < filled &&
              (state === "printing"
                ? "bg-state-printing"
                : state === "paused"
                  ? "bg-state-paused"
                  : "bg-primary")
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}
