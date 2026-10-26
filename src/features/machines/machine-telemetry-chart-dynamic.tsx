"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ds";
import type { TelemetrySnapshotRow } from "@/lib/printer-monitoring/telemetry-history";

const MachineTelemetryChart = dynamic(
  () =>
    import("@/components/machines/machine-telemetry-chart").then((m) => ({
      default: m.MachineTelemetryChart,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[200px] w-full rounded-xl" />,
  }
);

type Props = {
  snapshots: TelemetrySnapshotRow[];
  loading?: boolean;
};

export function MachineTelemetryChartDynamic({ snapshots, loading }: Props) {
  return <MachineTelemetryChart snapshots={snapshots} loading={loading} />;
}
