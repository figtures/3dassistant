import { cn } from "@/lib/utils";
import type { UiMachineState } from "@/lib/machine-state";

const colorClass: Record<UiMachineState, string> = {
  printing: "bg-state-printing pf-pulse-dot",
  paused: "bg-state-paused",
  idle: "bg-state-idle",
  error: "bg-state-error",
  offline: "bg-state-offline",
  maintenance: "bg-state-maintenance",
  untracked: "bg-state-unknown",
  unknown: "bg-state-unknown",
};

export type StateDotProps = {
  state: UiMachineState;
  className?: string;
  label?: string;
};

export function StateDot({ state, className, label }: StateDotProps) {
  return (
    <span
      className={cn("inline-flex size-2 shrink-0 rounded-full", colorClass[state], className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
