import { Badge } from "@/components/ds";
import { VENDOR_LABELS } from "@/lib/printer-cloud/types";
import type { Machine, PrinterVendor } from "@/types/database";
import { Cloud, Radio } from "lucide-react";

export function BridgeBindingBadge({ machine }: { machine: Machine }) {
  if (!machine.bridge_binding?.id) return null;
  return (
    <Badge tone="info">
      <Radio className="size-3" aria-hidden />
      Köprü
    </Badge>
  );
}

export function CloudIntegrationBadge({ machine }: { machine: Machine }) {
  const link = machine.machine_cloud_link;
  const account = link?.integration_account;
  if (!link?.enabled || !account) return null;
  const label = VENDOR_LABELS[account.vendor as PrinterVendor] ?? account.display_name;
  return (
    <Badge tone="primary">
      <Cloud className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}
