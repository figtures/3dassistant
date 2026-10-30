import type { FaultStatus } from "@/types/database";

export const FAULT_STATUS_LABELS: Record<FaultStatus, string> = {
  open: "Açık",
  in_progress: "Devam ediyor",
  resolved: "Çözüldü",
};

export type FaultStatusFilter = FaultStatus | "all";

export const DEFAULT_FAULT_TYPES = [
  "Nozzle tıkanması",
  "Filament kopması",
  "Isıtıcı arızası",
  "Motor arızası",
  "Kalibrasyon",
  "Elektronik arıza",
] as const;
