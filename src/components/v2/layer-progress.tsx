"use client";

import { cn } from "@/lib/utils";

type LayerProgressProps = {
  percent: number;
  segments?: number;
  className?: string;
  "aria-label"?: string;
};

export function LayerProgress({
  percent,
  segments = 24,
  className,
  "aria-label": ariaLabel = "Baskı ilerlemesi",
}: LayerProgressProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const filled = Math.round((clamped / 100) * segments);

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className={cn("flex gap-px", className)}
    >
      {Array.from({ length: segments }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 min-w-0 flex-1 rounded-[2px] transition-colors duration-[var(--motion-fast,120ms)]",
            i < filled ? "bg-primary" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}
