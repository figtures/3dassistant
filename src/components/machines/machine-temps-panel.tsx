"use client";

import type { Machine } from "@/types/database";

function fmt(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${Math.round(v)}°C`;
}

export function MachineTempsPanel({
  machine,
}: {
  machine: Pick<Machine, "bed_temp_c" | "nozzle_temp_c" | "chamber_temp_c">;
}) {
  const items = [
    { label: "Tabla", value: machine.bed_temp_c },
    { label: "Nozzle", value: machine.nozzle_temp_c },
    { label: "Oda", value: machine.chamber_temp_c },
  ];
  const any = items.some((i) => i.value != null);
  if (!any) {
    return (
      <p className="text-xs text-zinc-600">
        Sıcaklık verisi henüz yok — köprü veya bulut push sonrası görünür.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(({ label, value }) => (
        <div
          key={label}
          className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-3 py-2 text-center"
        >
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
          <p className="text-lg font-semibold tabular-nums text-zinc-100">{fmt(value)}</p>
        </div>
      ))}
    </div>
  );
}
