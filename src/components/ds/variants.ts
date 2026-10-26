import { cva, type VariantProps } from "class-variance-authority";
import type { UiMachineState } from "@/lib/machine-state";

const focusRing =
  "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium",
    "transition-colors duration-[var(--motion-fast,120ms)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-busy:cursor-wait",
    focusRing,
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "text-foreground hover:bg-accent hover:text-foreground",
        danger:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-[var(--density-control-h)] px-4",
        lg: "h-10 px-5",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export const inputVariants = cva(
  [
    "flex w-full rounded-lg border border-input bg-surface-inset px-3 py-2 text-sm text-foreground",
    "placeholder:text-muted-foreground",
    "transition-colors duration-[var(--motion-fast,120ms)]",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/30",
    focusRing,
  ].join(" "),
  {
    variants: {
      size: {
        md: "h-[var(--density-control-h)]",
        sm: "h-8 text-xs",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export const badgeToneVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground ring-border",
        primary: "bg-primary-subtle text-primary ring-primary/20",
        success: "bg-success-subtle text-success ring-success/20",
        warning: "bg-warning-subtle text-warning ring-warning/20",
        danger: "bg-destructive-subtle text-destructive ring-destructive/20",
        info: "bg-info-subtle text-info ring-info/20",
        steel: "bg-muted text-steel ring-border",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
);

export const MACHINE_STATE_LABELS: Record<UiMachineState, string> = {
  printing: "Baskıda",
  paused: "Duraklatıldı",
  idle: "Hazır",
  error: "Hata",
  offline: "Çevrimdışı",
  maintenance: "Bakımda",
  untracked: "Canlı takip yok",
  unknown: "Bilinmiyor",
};

export const machineStateBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      state: {
        printing: "bg-primary-subtle text-state-printing ring-primary/25",
        paused: "bg-warning-subtle text-state-paused ring-warning/25",
        idle: "bg-success-subtle text-state-idle ring-success/25",
        error: "bg-destructive-subtle text-state-error ring-destructive/25",
        offline: "bg-muted text-state-offline ring-border",
        maintenance:
          "bg-info-subtle text-state-maintenance ring-info/25",
        untracked: "bg-muted text-state-unknown ring-border",
        unknown: "bg-muted text-state-unknown ring-border",
      },
    },
  }
);

export const cardSurfaceVariants = cva(
  "rounded-xl border border-border text-card-foreground shadow-e0",
  {
    variants: {
      surface: {
        1: "bg-surface-1",
        2: "bg-surface-2 shadow-e1",
      },
    },
    defaultVariants: {
      surface: 1,
    },
  }
);
