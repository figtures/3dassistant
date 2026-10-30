"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ds";
import { useAttentionItems } from "@/features/dashboard/use-attention-items";
import { cn } from "@/lib/utils";

export function AttentionList() {
  const { items, isLoading } = useAttentionItems();

  if (isLoading) {
    return (
      <section aria-labelledby="attention-heading" className="space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section
      className="rounded-xl border border-border bg-card"
      aria-labelledby="attention-heading"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <AlertTriangle
          className="size-4 shrink-0 text-[var(--state-paused)]"
          aria-hidden
        />
        <h2 id="attention-heading" className="text-sm font-semibold text-foreground">
          Dikkat gerektirenler
        </h2>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm transition-colors",
                "hover:bg-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{item.label}</p>
                <p
                  className={cn(
                    "truncate text-xs",
                    item.tone === "error"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {item.detail}
                </p>
              </div>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
