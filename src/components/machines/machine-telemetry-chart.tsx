"use client";

import ReactECharts from "echarts-for-react";
import type { TelemetrySnapshotRow } from "@/lib/printer-monitoring/telemetry-history";

type Props = {
  snapshots: TelemetrySnapshotRow[];
  loading?: boolean;
};

export function MachineTelemetryChart({ snapshots, loading }: Props) {
  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-zinc-800/50" />;
  }
  if (snapshots.length < 2) {
    return (
      <p className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-4 py-8 text-center text-sm text-zinc-500">
        Grafik için yeterli veri yok. Köprü veya bulut bağlantısı bir süre çalıştığında ilerleme
        eğrisi burada görünür.
      </p>
    );
  }

  const times = snapshots.map((s) => new Date(s.recorded_at).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }));
  const progress = snapshots.map((s) =>
    s.progress_percent != null ? Math.round(Number(s.progress_percent)) : null
  );

  const option = {
    backgroundColor: "transparent",
    grid: { left: 40, right: 16, top: 24, bottom: 28 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: times,
      axisLabel: { color: "#71717a", fontSize: 10 },
      axisLine: { lineStyle: { color: "#3f3f46" } },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLabel: { color: "#71717a", formatter: "{value}%" },
      splitLine: { lineStyle: { color: "#27272a" } },
    },
    series: [
      {
        name: "İlerleme",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: progress,
        lineStyle: { color: "#34d399", width: 2 },
        areaStyle: { color: "rgba(52, 211, 153, 0.12)" },
      },
    ],
  };

  return (
    <ReactECharts option={option} style={{ height: 200, width: "100%" }} opts={{ renderer: "svg" }} />
  );
}
