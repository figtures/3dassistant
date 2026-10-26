"use client";

import type { Job } from "@/types/database";
import { formatCurrency } from "@/lib/format";
import {
  cellBorderColor,
  cellFillColor,
  readableTextColor,
} from "@/lib/color-contrast";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

const STATUS_FALLBACK_CLASS: Record<string, string> = {
  pending: "border-warning/40 bg-warning-subtle text-foreground",
  in_progress: "border-info/40 bg-info-subtle text-foreground",
  completed: "border-success/40 bg-success-subtle text-foreground",
  cancelled: "border-destructive/40 bg-destructive-subtle text-foreground",
};

type PlanJobBlockProps = {
  job: Job;
  onOpen: () => void;
};

export function PlanJobBlock({ job, onOpen }: PlanJobBlockProps) {
  const title = job.title ?? job.customer?.name ?? "Sipariş";
  const baseHex = job.cell_color?.trim();
  const useCustom = Boolean(baseHex && /^#?[0-9a-fA-F]{3,8}$/.test(baseHex));

  const style = useCustom
    ? {
        backgroundColor: cellFillColor(baseHex!),
        borderColor: cellBorderColor(baseHex!),
        color: readableTextColor(baseHex!.startsWith("#") ? baseHex! : `#${baseHex}`),
      }
    : undefined;

  return (
    <button
      type="button"
      onClick={onOpen}
      style={style}
      className={cn(
        "flex w-full min-h-9 flex-col gap-0.5 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors",
        "hover:border-border-strong focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
        !useCustom && (STATUS_FALLBACK_CLASS[job.status] ?? STATUS_FALLBACK_CLASS.pending)
      )}
    >
      <span className="truncate font-medium">{title}</span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground">
        {job.grams_used ? (
          <span className="font-mono tabular-nums">{job.grams_used} g</span>
        ) : null}
        {job.revenue_amount != null && job.revenue_amount > 0 ? (
          <span className="font-mono tabular-nums text-success">
            {formatCurrency(job.revenue_amount)}
          </span>
        ) : null}
        {job.material_color?.color_name ? (
          <span className="truncate">
            {job.material?.name
              ? `${job.material.name} · ${job.material_color.color_name}`
              : job.material_color.color_name}
          </span>
        ) : job.material?.name ? (
          <span className="truncate">{job.material.name}</span>
        ) : null}
      </span>
    </button>
  );
}

type PlanCellAddProps = {
  jobCount: number;
  onAdd: () => void;
  label: string;
};

export function PlanCellAdd({ jobCount, onAdd, label }: PlanCellAddProps) {
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={label}
      className={cn(
        "flex w-full min-h-9 items-center justify-center gap-1 rounded-lg border border-dashed border-border",
        "text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-subtle hover:text-primary",
        "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
      )}
    >
      <Plus className="size-4" strokeWidth={1.75} aria-hidden />
      {jobCount > 0 ? <span className="text-xs font-medium">Ekle</span> : null}
    </button>
  );
}
