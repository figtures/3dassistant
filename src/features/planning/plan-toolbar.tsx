"use client";

import { Button, Input } from "@/components/ds";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

const DAY_OPTIONS = [7, 14, 30] as const;

export type PlanToolbarProps = {
  days: number;
  onDaysChange: (days: number) => void;
  offset: number;
  onOffsetChange: (offset: number) => void;
  onGoToday: () => void;
  machineFilter: string;
  onMachineFilterChange: (id: string) => void;
  machines: { id: string; name: string }[];
  addingMachine: boolean;
  onAddingMachineChange: (open: boolean) => void;
  newMachineName: string;
  onNewMachineNameChange: (name: string) => void;
  onAddMachine: () => void;
  addMachineLoading?: boolean;
};

export function PlanToolbar({
  days,
  onDaysChange,
  offset,
  onOffsetChange,
  onGoToday,
  machineFilter,
  onMachineFilterChange,
  machines,
  addingMachine,
  onAddingMachineChange,
  newMachineName,
  onNewMachineNameChange,
  onAddMachine,
  addMachineLoading,
}: PlanToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onGoToday}
          aria-label="Bugüne git"
        >
          Bugün
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={() => onOffsetChange(offset + 1)}
          aria-label="Önceki hafta"
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={() => onOffsetChange(Math.max(0, offset - 1))}
          disabled={offset === 0}
          aria-label="Sonraki hafta"
        >
          <ChevronRight className="size-4" strokeWidth={1.75} />
        </Button>
        <label className="sr-only" htmlFor="plan-days">
          Görünüm aralığı
        </label>
        <select
          id="plan-days"
          value={days}
          onChange={(e) => onDaysChange(Number(e.target.value))}
          className={cn(
            "h-[var(--density-control-h)] rounded-lg border border-input bg-surface-inset px-3 text-sm text-foreground",
            "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          )}
        >
          {DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d} gün
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="plan-machine-filter">
          Makine filtresi
        </label>
        <select
          id="plan-machine-filter"
          value={machineFilter}
          onChange={(e) => onMachineFilterChange(e.target.value)}
          className={cn(
            "h-[var(--density-control-h)] min-w-[140px] rounded-lg border border-input bg-surface-inset px-3 text-sm text-foreground",
            "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          )}
        >
          <option value="">Tüm makineler</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        {addingMachine ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Input
              value={newMachineName}
              onChange={(e) => onNewMachineNameChange(e.target.value)}
              placeholder="Makine adı"
              className="min-w-[160px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddMachine();
                if (e.key === "Escape") onAddingMachineChange(false);
              }}
              aria-label="Yeni makine adı"
            />
            <Button
              type="button"
              size="sm"
              loading={addMachineLoading}
              onClick={onAddMachine}
            >
              Ekle
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAddingMachineChange(false)}
            >
              Vazgeç
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onAddingMachineChange(true)}
          >
            <Plus className="size-4" strokeWidth={1.75} aria-hidden />
            Makine ekle
          </Button>
        )}
      </div>
    </div>
  );
}
