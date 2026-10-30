"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ds/button";
import { cn } from "@/lib/utils";

export type BulkBarProps = {
  count: number;
  label?: string;
  onClear?: () => void;
  children?: ReactNode;
  className?: string;
};

export function BulkBar({
  count,
  label = "seçili",
  onClear,
  children,
  className,
}: BulkBarProps) {
  if (count <= 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span className="font-medium">
        {count} {label}
      </span>
      {children}
      {onClear ? (
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>
          Seçimi temizle
        </Button>
      ) : null}
    </div>
  );
}
