"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleDashed,
  Ellipsis,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ds/button";
import { buttonVariants } from "@/components/ds/variants";
import { cn } from "@/lib/utils";
import type { OnboardingStep, OnboardingStepStatus } from "@/features/onboarding/onboarding-state";

export type SetupChecklistStep = OnboardingStep & {
  description: string;
  actionLabel: string;
};

function CircularProgress({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const progress = total > 0 ? (completed / total) * 100 : 0;
  const strokeDashoffset = 100 - progress;

  return (
    <svg
      className="-rotate-90 shrink-0"
      height="14"
      viewBox="0 0 14 14"
      width="14"
      aria-hidden
    >
      <circle
        className="stroke-muted"
        cx="7"
        cy="7"
        fill="none"
        pathLength="100"
        r="6"
        strokeWidth="2"
      />
      <circle
        className="stroke-primary"
        cx="7"
        cy="7"
        fill="none"
        pathLength="100"
        r="6"
        strokeDasharray="100"
        strokeLinecap="round"
        strokeWidth="2"
        style={{ strokeDashoffset }}
      />
    </svg>
  );
}

function StepIndicator({ status }: { status: OnboardingStepStatus }) {
  if (status === "complete" || status === "skipped") {
    return (
      <CheckCircle2
        aria-hidden
        className="mt-0.5 size-[18px] shrink-0 text-primary"
      />
    );
  }
  if (status === "partial") {
    return (
      <CircleDashed
        aria-hidden
        className="mt-0.5 size-[18px] shrink-0 text-primary/70"
        strokeWidth={2}
      />
    );
  }
  return (
    <Circle
      aria-hidden
      className="mt-0.5 size-[18px] shrink-0 text-muted-foreground/50"
      strokeWidth={2}
    />
  );
}

export type SetupChecklistProps = {
  title?: string;
  steps: SetupChecklistStep[];
  completedCount: number;
  totalCount: number;
  isComplete?: boolean;
  onHide?: () => void;
  className?: string;
};

export function SetupChecklist({
  title = "Kurulum kontrol listesi",
  steps,
  completedCount,
  totalCount,
  isComplete = false,
  onHide,
  className,
}: SetupChecklistProps) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openStepId, setOpenStepId] = useState<string | null>(() => {
    if (isComplete) return null;
    const first = steps.find(
      (s) => s.status !== "complete" && s.status !== "skipped"
    );
    return first?.id ?? steps[0]?.id ?? null;
  });

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const visibleSteps = steps.filter((s) => s.status !== "hidden");

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm",
        className
      )}
      aria-labelledby="setup-checklist-heading"
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2
          id="setup-checklist-heading"
          className="text-balance text-base font-semibold text-foreground"
        >
          {isComplete ? "Kurulum tamam" : title}
        </h2>
        <div className="flex items-center justify-end gap-1.5">
          <CircularProgress completed={completedCount} total={totalCount} />
          <p className="text-sm text-muted-foreground tabular-nums">
            <span className="font-medium text-foreground">{completedCount}</span>
            {" / "}
            <span className="font-medium text-foreground">{totalCount}</span>
          </p>
          {onHide ? (
            <div ref={menuRef} className="relative ml-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-controls={menuId}
                aria-label="Kontrol listesi seçenekleri"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <Ellipsis className="size-4" aria-hidden />
              </Button>
              {menuOpen ? (
                <div
                  id={menuId}
                  role="menu"
                  className="absolute right-0 z-[var(--z-popover)] mt-1 min-w-[9rem] rounded-lg border border-border bg-popover p-1 shadow-md"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                    onClick={() => {
                      setMenuOpen(false);
                      onHide();
                    }}
                  >
                    <EyeOff className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    Gizle
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {isComplete ? (
        <p className="text-sm text-muted-foreground">
          Temel kurulum adımlarını tamamladınız. İstediğiniz zaman menüden
          makine, sipariş ve stok ekranlarına dönebilirsiniz.
        </p>
      ) : (
        <ul className="space-y-0">
          {visibleSteps.map((step, index) => {
            const isOpen = openStepId === step.id;
            const prevStep = visibleSteps[index - 1];
            const isPrevOpen = prevStep && openStepId === prevStep.id;
            const showBorderTop = index > 0 && !isOpen && !isPrevOpen;
            const done =
              step.status === "complete" || step.status === "skipped";

            return (
              <li
                key={step.id}
                className={cn(
                  showBorderTop && "border-t border-border",
                  isOpen && "rounded-lg"
                )}
              >
                <div
                  className={cn(
                    "rounded-lg transition-colors",
                    isOpen && "border border-border bg-muted/60"
                  )}
                >
                  <button
                    type="button"
                    className={cn(
                      "flex w-full cursor-pointer items-start justify-between gap-3 py-3 pl-3 pr-2 text-left",
                      "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                    )}
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpenStepId(isOpen ? null : step.id)
                    }
                  >
                    <span className="flex min-w-0 flex-1 gap-3">
                      <StepIndicator status={step.status} />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block font-semibold",
                            done ? "text-primary" : "text-foreground"
                          )}
                        >
                          {step.label}
                        </span>
                        {isOpen ? (
                          <span className="mt-2 block text-pretty text-sm text-muted-foreground">
                            {step.description}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {!isOpen ? (
                      <ChevronRight
                        className="mt-1 size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                  {isOpen ? (
                    <div className="px-3 pb-3 pl-12">
                      <Link
                        href={step.href}
                        className={buttonVariants({ variant: "primary", size: "sm" })}
                      >
                        {step.actionLabel}
                      </Link>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
