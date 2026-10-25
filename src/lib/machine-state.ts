import type { Machine } from "@/types/database";

export type UiMachineState =
  | "printing"
  | "paused"
  | "idle"
  | "error"
  | "offline"
  | "maintenance"
  | "untracked"
  | "unknown";

type MachineStateInput = Pick<
  Machine,
  "printer_state" | "connection_status"
> & {
  status?: Machine["status"];
};

export function deriveMachineState(m: MachineStateInput): UiMachineState {
  if (m.status === "maintenance") return "maintenance";
  if (m.printer_state === "error" || m.connection_status === "error") {
    return "error";
  }
  if (m.printer_state === "printing") return "printing";
  if (m.printer_state === "paused") return "paused";
  if (m.printer_state === "idle") return "idle";
  if (
    m.printer_state === "offline" ||
    m.connection_status === "disconnected" ||
    m.status === "offline"
  ) {
    return "offline";
  }
  if (m.connection_status === "never") return "untracked";
  return "unknown";
}

export function summarizeFleet(
  machines: MachineStateInput[]
): Record<UiMachineState, number> {
  const counts: Record<UiMachineState, number> = {
    printing: 0,
    paused: 0,
    idle: 0,
    error: 0,
    offline: 0,
    maintenance: 0,
    untracked: 0,
    unknown: 0,
  };
  for (const m of machines) {
    counts[deriveMachineState(m)] += 1;
  }
  return counts;
}
