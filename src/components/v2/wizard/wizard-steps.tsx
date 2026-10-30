"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardStepDef = {
  id: string;
  label: string;
};

type WizardStepsProps = {
  steps: WizardStepDef[];
  currentIndex: number;
  className?: string;
  /** Adım başlığı odaklanır (a11y). */
  headingId?: string;
};

export function WizardSteps({
  steps,
  currentIndex,
  className,
  headingId,
}: WizardStepsProps) {
  return (
    <nav aria-label="Bağlantı adımları" className={cn("w-full", className)}>
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;
          return (
            <li
              key={step.id}
              className="flex flex-1 items-start gap-2 sm:flex-col sm:items-center sm:text-center"
              aria-current={current ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
                  done && "border-primary bg-primary text-primary-foreground",
                  current && "border-primary bg-primary-subtle text-primary",
                  !done && !current && "border-border bg-card text-muted-foreground"
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
              </span>
              <span
                id={current && headingId ? headingId : undefined}
                tabIndex={current ? -1 : undefined}
                className={cn(
                  "text-xs font-medium leading-snug sm:text-sm",
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
