"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ds";
import { MachineCameraPanel } from "@/components/machines/machine-camera-panel";
import { MachineLiveStatus } from "@/components/machines/machine-live-status";
import { MachineTempsPanel } from "@/components/machines/machine-temps-panel";
import { MachineTelemetryChartDynamic } from "@/features/machines/machine-telemetry-chart-dynamic";
import type { Machine } from "@/types/database";
import type { TelemetrySnapshotRow } from "@/lib/printer-monitoring/telemetry-history";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

const TABS = [
  { id: "canli", label: "Canlı" },
  { id: "sicakliklar", label: "Sıcaklıklar" },
  { id: "kamera", label: "Kamera" },
  { id: "gecmis", label: "Geçmiş grafik" },
] as const;

export type MachineDetailTabId = (typeof TABS)[number]["id"];

type Props = {
  machine: Machine;
  machineId: string;
  history: TelemetrySnapshotRow[] | undefined;
  historyLoading: boolean;
  defaultTab?: MachineDetailTabId;
};

export function MachineTabs({
  machine,
  machineId,
  history,
  historyLoading,
  defaultTab = "canli",
}: Props) {
  const [tab, setTab] = useState<MachineDetailTabId>(defaultTab);
  const bridge = machine.bridge_binding;

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Makine detay sekmeleri"
        className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`machine-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`machine-tabpanel-${id}`}
            data-testid={`machine-tab-${id}`}
            onClick={() => setTab(id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors",
              "focus-visible:shadow-[var(--focus-ring)]",
              tab === id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {TABS.map(({ id, label }) => (
        <div
          key={id}
          role="tabpanel"
          id={`machine-tabpanel-${id}`}
          aria-labelledby={`machine-tab-${id}`}
          hidden={tab !== id}
          className={tab !== id ? "hidden" : undefined}
        >
          {id === "canli" && (
            <Card>
              <CardContent className="space-y-4 pt-6">
                <h2 className="text-sm font-medium text-foreground">{label}</h2>
                <MachineLiveStatus machine={machine} detailed />
                {machine.telemetry_updated_at && (
                  <p className="text-xs text-muted-foreground">
                    Telemetri:{" "}
                    {formatDistanceToNow(new Date(machine.telemetry_updated_at), {
                      addSuffix: true,
                      locale: tr,
                    })}
                  </p>
                )}
                {machine.error_message && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {machine.error_message}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {id === "sicakliklar" && (
            <Card>
              <CardContent className="space-y-4 pt-6">
                <h2 className="text-sm font-medium text-foreground">{label}</h2>
                <MachineTempsPanel machine={machine} />
              </CardContent>
            </Card>
          )}

          {id === "kamera" && (
            <Card>
              <CardContent className="space-y-4 pt-6">
                <h2 className="text-sm font-medium text-foreground">{label}</h2>
                <MachineCameraPanel
                  machineId={bridge?.id ? machineId : undefined}
                  streamUrl={machine.camera_stream_url}
                />
              </CardContent>
            </Card>
          )}

          {id === "gecmis" && (
            <Card>
              <CardContent className="space-y-4 pt-6">
                <h2 className="text-sm font-medium text-foreground">
                  İlerleme geçmişi (24 saat)
                </h2>
                <MachineTelemetryChartDynamic
                  snapshots={history ?? []}
                  loading={historyLoading}
                />
              </CardContent>
            </Card>
          )}
        </div>
      ))}
    </div>
  );
}
