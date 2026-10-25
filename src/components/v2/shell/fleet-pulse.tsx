"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useFleetLiveSse } from "@/hooks/use-machine-sse";
import { summarizeFleet } from "@/lib/machine-state";
import { cn } from "@/lib/utils";

function formatSummary(printing: number, errors: number, idle: number): string {
  const parts: string[] = [];
  if (printing > 0) parts.push(`${printing} baskıda`);
  if (errors > 0) parts.push(`${errors} hata`);
  if (idle > 0) parts.push(`${idle} boşta`);
  if (!parts.length) return "Filo hazır";
  return parts.join(" · ");
}

export function FleetPulse({ className }: { className?: string }) {
  const machines = useFleetLiveSse();
  const summary = useMemo(() => summarizeFleet(machines), [machines]);
  const text = formatSummary(summary.printing, summary.error, summary.idle);
  const liveRef = useRef<HTMLSpanElement>(null);
  const prevText = useRef(text);

  useEffect(() => {
    if (prevText.current !== text) {
      prevText.current = text;
    }
  }, [text]);

  if (!machines.length) {
    return (
      <Link
        href="/machines"
        className={cn(
          "hidden items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex",
          className
        )}
      >
        Yazıcı bağla
      </Link>
    );
  }

  return (
    <Link
      href="/machines"
      data-live
      className={cn(
        "hidden items-center gap-2 rounded-full border border-border bg-secondary/80 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex",
        className
      )}
      aria-label={`Filo özeti: ${text}`}
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full bg-[var(--state-printing)]",
          summary.printing > 0 && "pf-pulse-dot"
        )}
        aria-hidden
      />
      <span
        ref={liveRef}
        className="tabular-nums"
        aria-live="polite"
        aria-atomic="true"
      >
        {text}
      </span>
    </Link>
  );
}
