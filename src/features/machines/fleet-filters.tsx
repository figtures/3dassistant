"use client";

import { Button, Input } from "@/components/ds";
import { MACHINE_STATE_LABELS } from "@/components/ds/variants";
import type { UiMachineState } from "@/lib/machine-state";
import { summarizeFleet } from "@/lib/machine-state";
import type { Machine } from "@/types/database";
import { LayoutGrid, List, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTER_STATES: (UiMachineState | "all")[] = [
  "all",
  "printing",
  "idle",
  "paused",
  "error",
  "offline",
  "maintenance",
  "untracked",
];

export type FleetFiltersProps = {
  machines: Machine[];
  stateFilter: UiMachineState | "all";
  onStateFilterChange: (state: UiMachineState | "all") => void;
  search: string;
  onSearchChange: (q: string) => void;
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
};

export function FleetFilters({
  machines,
  stateFilter,
  onStateFilterChange,
  search,
  onSearchChange,
  view,
  onViewChange,
}: FleetFiltersProps) {
  const summary = summarizeFleet(machines);

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Makine veya model ara…"
          className="pl-9"
          aria-label="Makine ara"
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Durum filtresi">
          {FILTER_STATES.map((key) => {
            const count =
              key === "all" ? machines.length : summary[key as UiMachineState];
            if (key !== "all" && count === 0) return null;
            const label =
              key === "all" ? "Tümü" : MACHINE_STATE_LABELS[key as UiMachineState];
            const active = stateFilter === key;
            return (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={active ? "primary" : "secondary"}
                onClick={() => onStateFilterChange(key)}
                aria-pressed={active}
              >
                {label}
                <span className="tabular-nums text-muted-foreground"> {count}</span>
              </Button>
            );
          })}
        </div>

        <div
          className="flex shrink-0 gap-1 rounded-lg border border-border p-1"
          role="group"
          aria-label="Görünüm"
        >
          <Button
            type="button"
            size="sm"
            variant={view === "grid" ? "primary" : "ghost"}
            onClick={() => onViewChange("grid")}
            aria-pressed={view === "grid"}
            aria-label="Kart görünümü"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "list" ? "primary" : "ghost"}
            onClick={() => onViewChange("list")}
            aria-pressed={view === "list"}
            aria-label="Liste görünümü"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function FleetFiltersEmptyHint({ onClear }: { onClear: () => void }) {
  return (
    <p className={cn("text-center text-sm text-muted-foreground")}>
      Filtrelere uyan makine yok.{" "}
      <button
        type="button"
        onClick={onClear}
        className="font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
      >
        Filtreleri temizle
      </button>
    </p>
  );
}
