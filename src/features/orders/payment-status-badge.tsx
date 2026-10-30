import { Badge } from "@/components/ds";
import { PAYMENT_STATUS_LABELS } from "@/features/orders/order-constants";
import type { PaymentStatus } from "@/types/database";

const PAYMENT_TONE: Record<
  PaymentStatus,
  "neutral" | "warning" | "success"
> = {
  unpaid: "neutral",
  partial: "warning",
  paid: "success",
  upcoming: "warning",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge tone={PAYMENT_TONE[status]} className="whitespace-nowrap">
      {PAYMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
