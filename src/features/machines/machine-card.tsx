"use client";

import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
} from "@/components/ds";
import { StateDot } from "@/components/v2/machines/state-dot";
import { LayerProgress } from "@/components/v2/machines/layer-progress";
import { deriveMachineState } from "@/lib/machine-state";
import { MACHINE_STATE_LABELS } from "@/components/ds/variants";
import type { Machine } from "@/types/database";
import {
  BridgeBindingBadge,
  CloudIntegrationBadge,
} from "@/features/machines/connection-badges";
import { isLiveTracked } from "@/features/machines/machine-utils";
import { buttonVariants } from "@/components/ds/variants";
import { cn } from "@/lib/utils";
import { ExternalLink, Pencil, RefreshCw, Trash2, Wrench } from "lucide-react";

function formatPrintTime(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds < 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h} sa ${m} dk kaldı`;
  return `${m}:${String(s).padStart(2, "0")} kaldı`;
}

export type MachineCardActions = {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSync: (id: string) => void;
  onMaintenance: (id: string) => void;
  onReconnect: (machine: Machine) => void;
  onConnect: () => void;
  syncingId: string | null;
};

export type MachineCardProps = {
  machine: Machine;
  actions: MachineCardActions;
};

export function MachineCard({ machine, actions }: MachineCardProps) {
  const state = deriveMachineState(machine);
  const tracked = isLiveTracked(machine);
  const printing = state === "printing";
  const progress =
    machine.progress_percent != null
      ? Math.round(Number(machine.progress_percent))
      : null;
  const accountError =
    machine.machine_cloud_link?.integration_account?.status === "error";
  const canSync =
    machine.machine_cloud_link?.enabled || machine.bridge_binding?.id;

  return (
    <Card className="flex h-full flex-col" data-testid={`machine-card-${machine.id}`}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link
              href={`/machines/${machine.id}`}
              className="truncate text-base font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              {machine.name}
            </Link>
            {machine.model ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {machine.model}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-0.5">
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

        <div className="flex flex-wrap items-center gap-2">
          <StateDot state={state} label={MACHINE_STATE_LABELS[state]} />
          <Badge machineState={state} data-live />
          <CloudIntegrationBadge machine={machine} />
          <BridgeBindingBadge machine={machine} />
        </div>
      </CardHeader>

      <CardContent className="mt-auto space-y-3 pt-0">
        {!tracked ? (
          <p className="text-xs text-muted-foreground">
            Canlı takip yok ·{" "}
            <button
              type="button"
              onClick={actions.onConnect}
              className="font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              Bağla
            </button>
          </p>
        ) : (
          <>
            {machine.job_name ? (
              <p className="truncate text-sm text-foreground" data-live>
                {machine.job_name}
              </p>
            ) : null}
            {printing && progress != null ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
                  <span>İlerleme</span>
                  <span data-live>{progress}%</span>
                </div>
                <LayerProgress value={progress} state={state} />
              </div>
            ) : null}
            {machine.print_time_seconds != null && printing ? (
              <p className="text-xs tabular-nums text-muted-foreground" data-live>
                {formatPrintTime(machine.print_time_seconds)}
              </p>
            ) : null}
            {(machine.bed_temp_c != null || machine.nozzle_temp_c != null) && (
              <p className="font-mono text-xs tabular-nums text-muted-foreground" data-live>
                {machine.nozzle_temp_c != null
                  ? `Nozul ${Math.round(machine.nozzle_temp_c)}°C`
                  : null}
                {machine.bed_temp_c != null
                  ? `${machine.nozzle_temp_c != null ? " · " : ""}Tabla ${Math.round(machine.bed_temp_c)}°C`
                  : null}
              </p>
            )}
            {machine.error_message ? (
              <p className="line-clamp-2 text-xs text-destructive" data-live>
                {machine.error_message}
              </p>
            ) : null}
          </>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {accountError ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => actions.onReconnect(machine)}
            >
              Hesabı yeniden bağla
            </Button>
          ) : null}
          {canSync ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={actions.syncingId === machine.id}
              loading={actions.syncingId === machine.id}
              onClick={() => actions.onSync(machine.id)}
            >
              {actions.syncingId !== machine.id ? (
                <RefreshCw className="size-3.5" aria-hidden />
              ) : null}
              {machine.bridge_binding?.id ? "Köprü durumu" : "Şimdi güncelle"}
            </Button>
          ) : null}
          {machine.status !== "maintenance" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => actions.onMaintenance(machine.id)}
            >
              <Wrench className="size-3.5" aria-hidden />
              Bakıma al
            </Button>
          ) : null}
          <Link
            href={`/machines/${machine.id}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Detay
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
