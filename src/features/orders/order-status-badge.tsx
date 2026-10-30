import { Badge } from "@/components/ds";
import { ORDER_STATUS_LABELS } from "@/features/orders/order-constants";
import type { JobStatus } from "@/types/database";

const STATUS_TONE: Record<
  JobStatus,
  "neutral" | "warning" | "success" | "danger"
> = {
  pending: "warning",
  in_progress: "neutral",
  completed: "success",
  cancelled: "danger",
};

export function OrderStatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} className="whitespace-nowrap">
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
