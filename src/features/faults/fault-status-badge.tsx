import { Badge } from "@/components/ds";
import { FAULT_STATUS_LABELS } from "@/features/faults/fault-constants";
import type { FaultStatus } from "@/types/database";

export function FaultStatusBadge({ status }: { status: FaultStatus }) {
  const tone =
    status === "resolved" ? "success" : status === "in_progress" ? "warning" : "danger";
  return <Badge tone={tone}>{FAULT_STATUS_LABELS[status]}</Badge>;
}
