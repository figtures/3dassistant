"use client";

import { MachineDetailPanel } from "@/components/machines/machine-detail-panel";

export default function MachineDetailLegacyPage({
  machineId,
}: {
  machineId: string;
}) {
  return <MachineDetailPanel machineId={machineId} />;
}
