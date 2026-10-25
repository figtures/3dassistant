"use client";

import Link from "next/link";
import { useMachines } from "@/hooks/use-data";
import { useFleetLiveSse } from "@/hooks/use-machine-sse";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MachineLiveStatus } from "@/components/machines/machine-live-status";
import { Cpu, ChevronRight } from "lucide-react";
import type { MachinePrinterState } from "@/types/database";

const STATE_ORDER: Record<MachinePrinterState, number> = {
  printing: 0,
  paused: 1,
  error: 2,
  idle: 3,
  offline: 4,
  unknown: 5,
};

export function MachineFleetPanel() {
  const { data: machines = [], isLoading } = useMachines({ live: true });
  const fleetLive = useFleetLiveSse(true);
  const merged = machines.map((m) => {
    const live = fleetLive.find((f) => f.id === m.id);
    return live ? { ...m, ...live } : m;
  });

  const monitored = merged.filter(
    (m) =>
      m.bridge_binding?.id ||
      m.machine_cloud_link?.enabled ||
      (m.machine_connection && m.machine_connection.adapter_type !== "manual")
  );

  const sorted = [...monitored].sort(
    (a, b) =>
      (STATE_ORDER[a.printer_state ?? "unknown"] ?? 9) -
      (STATE_ORDER[b.printer_state ?? "unknown"] ?? 9)
  );

  const printing = monitored.filter((m) => m.printer_state === "printing").length;

  return (
    <Card className="animate-fade-up">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-sky-400" />
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Atölye canlı</h2>
            <p className="text-xs text-zinc-500">
              {isLoading
                ? "Yükleniyor…"
                : `${printing} baskıda · ${monitored.length} izlenen · SSE`}
            </p>
          </div>
        </div>
        <Link
          href="/machines"
          className="text-xs text-sky-400 hover:text-sky-300"
        >
          Tümü →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Canlı makine yok.{" "}
            <Link href="/machines" className="text-sky-400 hover:text-sky-300">
              Yazıcı bağla veya köprü kur
            </Link>
          </p>
        ) : (
          sorted.slice(0, 5).map((m) => (
            <Link
              key={m.id}
              href={`/machines/${m.id}`}
              className="flex items-start gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-3 transition-colors hover:border-zinc-700"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-zinc-200">{m.name}</span>
                  {m.printer_state === "printing" && (
                    <Badge variant="success" className="text-[10px]">Baskıda</Badge>
                  )}
                </div>
                <MachineLiveStatus machine={m} compact />
              </div>
              {m.bridge_binding?.id && m.printer_state === "printing" && (
                <div className="hidden h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-black sm:block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/machines/${m.id}/camera?t=${Math.floor(Date.now() / 5000)}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-zinc-600" />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
