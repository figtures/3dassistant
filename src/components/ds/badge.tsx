import { cn } from "@/lib/utils";
import type { UiMachineState } from "@/lib/machine-state";
import {
  badgeToneVariants,
  MACHINE_STATE_LABELS,
  machineStateBadgeVariants,
} from "@/components/ds/variants";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "steel";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  machineState?: UiMachineState;
};

export function Badge({
  className,
  tone = "neutral",
  machineState,
  children,
  ...props
}: BadgeProps) {
  if (machineState) {
    return (
      <span
        data-slot="badge"
        data-state={machineState}
        className={cn(machineStateBadgeVariants({ state: machineState }), className)}
        {...props}
      >
        {children ?? MACHINE_STATE_LABELS[machineState]}
      </span>
    );
  }

  return (
    <span
      data-slot="badge"
      data-tone={tone}
      className={cn(badgeToneVariants({ tone }), className)}
      {...props}
    >
      {children}
    </span>
  );
}
