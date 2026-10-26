import type { Machine } from "@/types/database";
import { deriveMachineState, type UiMachineState } from "@/lib/machine-state";

export function mergeFleetLive(
  machines: Machine[],
  live: Pick<Machine, "id">[]
): Machine[] {
  return machines.map((m) => {
    const patch = live.find((f) => f.id === m.id);
    return patch ? { ...m, ...patch } : m;
  });
}

export function isLiveTracked(machine: Machine): boolean {
  const conn = machine.machine_connection;
  return Boolean(
    machine.bridge_binding?.id ||
      machine.machine_cloud_link?.enabled ||
      (conn && conn.adapter_type !== "manual")
  );
}

export function matchesMachineSearch(machine: Machine, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = `${machine.name} ${machine.model ?? ""}`.toLowerCase();
  return hay.includes(needle);
}

export function matchesStateFilter(
  machine: Machine,
  filter: UiMachineState | "all"
): boolean {
  if (filter === "all") return true;
  return deriveMachineState(machine) === filter;
}
