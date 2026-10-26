import type { UiMachineState } from "@/lib/machine-state";

const focusRing =
  "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

type VariantOptions<V extends Record<string, Record<string, string>>> = {
  [K in keyof V]?: keyof V[K] | null | undefined;
};

function variantBuilder<V extends Record<string, Record<string, string>>>(
  base: string,
  variants: V,
  defaults?: VariantOptions<V>
) {
  return (options?: VariantOptions<V>) => {
    const resolved = { ...defaults, ...options } as Record<string, string>;
    const parts = [base];
    for (const key of Object.keys(variants) as (keyof V)[]) {
      const value = resolved[key as string];
      if (value != null && variants[key][value as keyof V[typeof key]]) {
        parts.push(variants[key][value as keyof V[typeof key]]);
      }
    }
    return parts.join(" ");
  };
}

const buttonVariantMap = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary:
    "border border-border bg-secondary text-secondary-foreground hover:bg-accent",
  ghost: "text-foreground hover:bg-accent hover:text-foreground",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
} as const;

const buttonSizeMap = {
  sm: "h-8 px-3 text-xs",
  md: "h-[var(--density-control-h)] px-4",
  lg: "h-10 px-5",
  icon: "size-9",
} as const;

export const buttonVariants = variantBuilder(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium",
    "transition-colors duration-[var(--motion-fast,120ms)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-busy:cursor-wait",
    focusRing,
  ].join(" "),
  { variant: buttonVariantMap, size: buttonSizeMap },
  { variant: "primary", size: "md" }
);

export type ButtonVariantProps = {
  variant?: keyof typeof buttonVariantMap;
  size?: keyof typeof buttonSizeMap;
};

export const inputVariants = variantBuilder(
  [
    "flex w-full rounded-lg border border-input bg-surface-inset px-3 py-2 text-sm text-foreground",
    "placeholder:text-muted-foreground",
    "transition-colors duration-[var(--motion-fast,120ms)]",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/30",
    focusRing,
  ].join(" "),
  {
    size: {
      md: "h-[var(--density-control-h)]",
      sm: "h-8 text-xs",
    },
  },
  { size: "md" }
);

const badgeToneMap = {
  neutral: "bg-muted text-muted-foreground ring-border",
  primary: "bg-primary-subtle text-primary ring-primary/20",
  success: "bg-success-subtle text-success ring-success/20",
  warning: "bg-warning-subtle text-warning ring-warning/20",
  danger: "bg-destructive-subtle text-destructive ring-destructive/20",
  info: "bg-info-subtle text-info ring-info/20",
  steel: "bg-muted text-steel ring-border",
} as const;

export const badgeToneVariants = variantBuilder(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
  { tone: badgeToneMap },
  { tone: "neutral" }
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

const machineStateMap = {
  printing: "bg-primary-subtle text-state-printing ring-primary/25",
  paused: "bg-warning-subtle text-state-paused ring-warning/25",
  idle: "bg-success-subtle text-state-idle ring-success/25",
  error: "bg-destructive-subtle text-state-error ring-destructive/25",
  offline: "bg-muted text-state-offline ring-border",
  maintenance: "bg-info-subtle text-state-maintenance ring-info/25",
  untracked: "bg-muted text-state-unknown ring-border",
  unknown: "bg-muted text-state-unknown ring-border",
} as const;

export const machineStateBadgeVariants = variantBuilder(
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
  { state: machineStateMap }
);

export const cardSurfaceVariants = variantBuilder(
  "rounded-xl border border-border text-card-foreground shadow-e0",
  {
    surface: {
      1: "bg-surface-1",
      2: "bg-surface-2 shadow-e1",
    },
  },
  { surface: 1 }
);
