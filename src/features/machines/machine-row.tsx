"use client";

import Link from "next/link";
import { Badge, Button } from "@/components/ds";
import { StateDot } from "@/components/v2/machines/state-dot";
import { deriveMachineState } from "@/lib/machine-state";
import { MACHINE_STATE_LABELS } from "@/components/ds/variants";
import type { Machine } from "@/types/database";
import {
  BridgeBindingBadge,
  CloudIntegrationBadge,
} from "@/features/machines/connection-badges";
import { isLiveTracked } from "@/features/machines/machine-utils";
import type { MachineCardActions } from "@/features/machines/machine-card";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type MachineRowProps = {
  machine: Machine;
  actions: MachineCardActions;
};

export function MachineRow({ machine, actions }: MachineRowProps) {
  const state = deriveMachineState(machine);
  const tracked = isLiveTracked(machine);
  const progress =
    machine.progress_percent != null
      ? Math.round(Number(machine.progress_percent))
      : null;
  const canSync =
    machine.machine_cloud_link?.enabled || machine.bridge_binding?.id;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center",
        "hover:border-border-strong"
      )}
      data-testid={`machine-row-${machine.id}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <StateDot state={state} label={MACHINE_STATE_LABELS[state]} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/machines/${machine.id}`}
            className="truncate font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            {machine.name}
          </Link>
          {machine.model ? (
            <p className="truncate text-xs text-muted-foreground">{machine.model}</p>
          ) : null}
        </div>
        <Badge machineState={state} className="hidden sm:inline-flex" data-live />
        <div className="hidden flex-wrap gap-1 md:flex">
          <CloudIntegrationBadge machine={machine} />
          <BridgeBindingBadge machine={machine} />
        </div>
      </div>

      <div className="min-w-0 flex-1 text-sm text-muted-foreground sm:max-w-xs">
        {!tracked ? (
          <button
            type="button"
            onClick={actions.onConnect}
            className="text-left text-xs font-medium text-primary hover:text-primary-hover"
          >
            Canlı takip yok · Bağla
          </button>
        ) : (
          <p className="truncate text-xs" data-live>
            {machine.job_name ?? MACHINE_STATE_LABELS[state]}
            {progress != null && state === "printing" ? ` · ${progress}%` : ""}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap gap-1">
        {canSync ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={actions.syncingId === machine.id}
            loading={actions.syncingId === machine.id}
            onClick={() => actions.onSync(machine.id)}
            aria-label={`${machine.name} durumunu güncelle`}
          >
            <RefreshCw className="size-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => actions.onEdit(machine.id)}
          aria-label={`${machine.name} düzenle`}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => actions.onDelete(machine.id)}
          aria-label={`${machine.name} sil`}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
