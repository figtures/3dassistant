"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardStep = {
  id: string;
  label: string;
};

type OnboardingStepperProps = {
  steps: WizardStep[];
  currentIndex: number;
  className?: string;
};

export function OnboardingStepper({
  steps,
  currentIndex,
  className,
}: OnboardingStepperProps) {
  return (
    <nav
      aria-label="Kurulum adımları"
      className={cn("w-full", className)}
    >
      <ol className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;
          return (
            <li
              key={step.id}
              className="flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center"
              aria-current={current ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-medium tabular-nums transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  current &&
                    "border-primary bg-primary-subtle text-primary",
                  !done && !current && "border-border bg-card text-muted-foreground"
                )}
              >
                {done ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  "text-sm font-medium leading-snug",
                  current ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
