"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { DashboardMetrics } from "@/types/database";
import { formatDateTR } from "@/hooks/use-data";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const chartTheme = {
  text: "#71717a",
  line: "rgba(255,255,255,0.06)",
  tooltip: {
    backgroundColor: "rgba(24,24,27,0.95)",
    borderColor: "rgba(255,255,255,0.08)",
    textStyle: { color: "#fafafa", fontSize: 12 },
  },
};

interface DashboardChartsProps {
  metrics: DashboardMetrics;
}

export function DashboardCharts({ metrics }: DashboardChartsProps) {
  const jobsByDateOption = useMemo(
    () => ({
      backgroundColor: "transparent",
      tooltip: { ...chartTheme.tooltip, trigger: "axis" },
      grid: { left: 44, right: 16, top: 24, bottom: 48 },
      xAxis: {
        type: "category",
        data: metrics.jobsByDate.map((d) => formatDateTR(d.date)),
        axisLabel: { color: chartTheme.text, rotate: 30, fontSize: 10 },
        axisLine: { lineStyle: { color: chartTheme.line } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: chartTheme.text, fontSize: 10 },
        splitLine: { lineStyle: { color: chartTheme.line } },
      },
      series: [{
        name: "İş Sayısı",
        type: "line",
        smooth: true,
        data: metrics.jobsByDate.map((d) => d.count),
        areaStyle: {
          color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: "rgba(56,189,248,0.25)" }, { offset: 1, color: "rgba(56,189,248,0)" }],
          },
        },
        lineStyle: { color: "#38bdf8", width: 2 },
        itemStyle: { color: "#38bdf8" },
        symbol: "circle",
        symbolSize: 6,
      }],
    }),
    [metrics.jobsByDate]
  );

  const gramsByDateOption = useMemo(
    () => ({
      backgroundColor: "transparent",
      tooltip: { ...chartTheme.tooltip, trigger: "axis" },
      grid: { left: 52, right: 16, top: 24, bottom: 48 },
      xAxis: {
        type: "category",
        data: metrics.gramsByDate.map((d) => formatDateTR(d.date)),
        axisLabel: { color: chartTheme.text, rotate: 30, fontSize: 10 },
        axisLine: { lineStyle: { color: chartTheme.line } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        name: "g",
        nameTextStyle: { color: chartTheme.text, fontSize: 10 },
        axisLabel: { color: chartTheme.text, fontSize: 10 },
        splitLine: { lineStyle: { color: chartTheme.line } },
      },
      series: [{
        name: "Malzeme (g)",
        type: "bar",
        data: metrics.gramsByDate.map((d) => d.grams),
        itemStyle: {
          color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: "#818cf8" }, { offset: 1, color: "#38bdf8" }],
          },
          borderRadius: [6, 6, 0, 0],
        },
        barMaxWidth: 32,
      }],
    }),
    [metrics.gramsByDate]
  );

  const machineOption = useMemo(
    () => ({
      backgroundColor: "transparent",
      tooltip: { ...chartTheme.tooltip, trigger: "item" },
      color: ["#38bdf8", "#818cf8", "#34d399", "#fbbf24", "#f87171", "#a78bfa"],
      series: [{
        type: "pie",
        radius: ["45%", "72%"],
        padAngle: 3,
        data: metrics.jobsByMachine.map((m) => ({ name: m.name, value: m.count })),
        label: { color: chartTheme.text, fontSize: 11 },
        itemStyle: { borderRadius: 6, borderColor: "#09090b", borderWidth: 2 },
      }],
    }),
    [metrics.jobsByMachine]
  );

  const statusOption = useMemo(
    () => ({
      backgroundColor: "transparent",
      tooltip: { ...chartTheme.tooltip, trigger: "axis" },
      grid: { left: 88, right: 16, top: 8, bottom: 8 },
      xAxis: { type: "value", axisLabel: { color: chartTheme.text, fontSize: 10 }, splitLine: { show: false } },
      yAxis: {
        type: "category",
        data: metrics.jobsByStatus.map((s) => s.status),
        axisLabel: { color: chartTheme.text, fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [{
        type: "bar",
        data: metrics.jobsByStatus.map((s) => s.count),
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: (params: { dataIndex: number }) =>
            ["#fbbf24", "#38bdf8", "#34d399", "#f87171"][params.dataIndex],
        },
        barMaxWidth: 20,
      }],
    }),
    [metrics.jobsByStatus]
  );

  const materialOption = useMemo(
    () => ({
      backgroundColor: "transparent",
      tooltip: { ...chartTheme.tooltip, trigger: "item", formatter: "{b}: {c}g" },
      color: ["#38bdf8", "#818cf8", "#34d399", "#fbbf24", "#a78bfa"],
      series: [{
        type: "pie",
        radius: "68%",
        data: metrics.jobsByMaterial.map((m) => ({ name: m.name, value: m.grams })),
        label: { color: chartTheme.text, fontSize: 11 },
        itemStyle: { borderRadius: 4, borderColor: "#09090b", borderWidth: 2 },
      }],
    }),
    [metrics.jobsByMaterial]
  );

  const paymentOption = useMemo(
    () => ({
      backgroundColor: "transparent",
      tooltip: { ...chartTheme.tooltip, trigger: "item" },
      color: ["#f87171", "#fbbf24", "#34d399", "#818cf8"],
      series: [{
        type: "pie",
        radius: ["42%", "68%"],
        padAngle: 3,
        data: metrics.jobsByPaymentStatus.map((p) => ({ name: p.status, value: p.count })),
        label: { color: chartTheme.text, fontSize: 11 },
        itemStyle: { borderRadius: 6, borderColor: "#09090b", borderWidth: 2 },
      }],
    }),
    [metrics.jobsByPaymentStatus]
  );

  const sourceOption = useMemo(
    () => ({
      backgroundColor: "transparent",
      tooltip: { ...chartTheme.tooltip, trigger: "axis" },
      grid: { left: 100, right: 16, top: 8, bottom: 8 },
      xAxis: { type: "value", axisLabel: { color: chartTheme.text, fontSize: 10 }, splitLine: { show: false } },
      yAxis: {
        type: "category",
        data: metrics.customersBySource.map((s) => s.source),
        axisLabel: { color: chartTheme.text, fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [{
        type: "bar",
        data: metrics.customersBySource.map((s) => s.count),
        itemStyle: { borderRadius: [0, 6, 6, 0], color: "#818cf8" },
        barMaxWidth: 18,
      }],
    }),
    [metrics.customersBySource]
  );

  const durationOption = useMemo(
    () => ({
      backgroundColor: "transparent",
      tooltip: { ...chartTheme.tooltip, trigger: "axis", formatter: (p: { value: number }[]) => `${Math.round(p[0]?.value ?? 0)} dk` },
      grid: { left: 52, right: 16, top: 24, bottom: 48 },
      xAxis: {
        type: "category",
        data: metrics.durationByDate.map((d) => formatDateTR(d.date)),
        axisLabel: { color: chartTheme.text, rotate: 30, fontSize: 10 },
        axisLine: { lineStyle: { color: chartTheme.line } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        name: "dk",
        nameTextStyle: { color: chartTheme.text, fontSize: 10 },
        axisLabel: { color: chartTheme.text, fontSize: 10 },
        splitLine: { lineStyle: { color: chartTheme.line } },
      },
      series: [{
        name: "Süre",
        type: "line",
        smooth: true,
        data: metrics.durationByDate.map((d) => d.minutes),
        lineStyle: { color: "#a78bfa", width: 2 },
        itemStyle: { color: "#a78bfa" },
        areaStyle: {
          color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: "rgba(167,139,250,0.25)" }, { offset: 1, color: "rgba(167,139,250,0)" }],
          },
        },
      }],
    }),
    [metrics.durationByDate]
  );

  const faultOption = useMemo(
    () => ({
      backgroundColor: "transparent",
      tooltip: { ...chartTheme.tooltip, trigger: "axis", formatter: (p: { value: number }[]) => `${(p[0]?.value ?? 0).toFixed(1)} sa` },
      grid: { left: 88, right: 16, top: 8, bottom: 8 },
      xAxis: { type: "value", axisLabel: { color: chartTheme.text, fontSize: 10 }, splitLine: { show: false } },
      yAxis: {
        type: "category",
        data: metrics.faultDowntimeByMachine.map((f) => f.name),
        axisLabel: { color: chartTheme.text, fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [{
        type: "bar",
        data: metrics.faultDowntimeByMachine.map((f) => f.hours),
        itemStyle: { borderRadius: [0, 6, 6, 0], color: "#f87171" },
        barMaxWidth: 18,
      }],
    }),
    [metrics.faultDowntimeByMachine]
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <ChartCard title="Günlük İş Sayısı" subtitle="Zaman içindeki iş hacmi">
        <ReactECharts option={jobsByDateOption} style={{ height: 260 }} />
      </ChartCard>
      <ChartCard title="Malzeme Kullanımı" subtitle="Günlük gram tüketimi">
        <ReactECharts option={gramsByDateOption} style={{ height: 260 }} />
      </ChartCard>
      <ChartCard title="Makine Dağılımı" subtitle="İş yükü paylaşımı">
        <ReactECharts option={machineOption} style={{ height: 260 }} />
      </ChartCard>
      <ChartCard title="Durum Özeti" subtitle="İş emri durumları">
        <ReactECharts option={statusOption} style={{ height: 260 }} />
      </ChartCard>
      <ChartCard title="Malzeme Dağılımı" subtitle="Toplam tüketim" className="md:col-span-2 xl:col-span-1">
        <ReactECharts option={materialOption} style={{ height: 260 }} />
      </ChartCard>
      <ChartCard title="Ödeme Durumu" subtitle="İş emri ödemeleri">
        <ReactECharts option={paymentOption} style={{ height: 260 }} />
      </ChartCard>
      <ChartCard title="İş Süreleri" subtitle="Günlük çalışma (dk)">
        <ReactECharts option={durationOption} style={{ height: 260 }} />
      </ChartCard>
      <ChartCard title="Müşteri Kaynakları" subtitle="Nereden geldiler">
        <ReactECharts option={sourceOption} style={{ height: 260 }} />
      </ChartCard>
      {metrics.faultDowntimeByMachine.length > 0 && (
        <ChartCard title="Arıza Duruşu" subtitle="Makine bazında (saat)" className="md:col-span-2">
          <ReactECharts option={faultOption} style={{ height: 260 }} />
        </ChartCard>
      )}
      {metrics.procurementSpendByDate.length > 0 && (
        <ChartCard title="Tedarik Harcaması" subtitle="Günlük alım tutarı">
          <ReactECharts
            option={{
              backgroundColor: "transparent",
              tooltip: { ...chartTheme.tooltip, trigger: "axis" },
              grid: { left: 52, right: 16, top: 24, bottom: 48 },
              xAxis: {
                type: "category",
                data: metrics.procurementSpendByDate.map((d) => formatDateTR(d.date)),
                axisLabel: { color: chartTheme.text, rotate: 30, fontSize: 10 },
                axisLine: { lineStyle: { color: chartTheme.line } },
              },
              yAxis: {
                type: "value",
                axisLabel: { color: chartTheme.text, fontSize: 10 },
                splitLine: { lineStyle: { color: chartTheme.line } },
              },
              series: [{
                name: "Harcama",
                type: "bar",
                data: metrics.procurementSpendByDate.map((d) => d.amount),
                itemStyle: { color: "#f59e0b" },
              }],
            }}
            style={{ height: 260 }}
          />
        </ChartCard>
      )}
      {metrics.salesByChannel.length > 0 && (
        <ChartCard title="Satış Kanalları" subtitle="Adet ve gelir">
          <ReactECharts
            option={{
              backgroundColor: "transparent",
              tooltip: { ...chartTheme.tooltip, trigger: "axis" },
              legend: { textStyle: { color: chartTheme.text }, bottom: 0 },
              grid: { left: 44, right: 16, top: 24, bottom: 56 },
              xAxis: {
                type: "category",
                data: metrics.salesByChannel.map((d) => d.channel),
                axisLabel: { color: chartTheme.text, fontSize: 10 },
                axisLine: { lineStyle: { color: chartTheme.line } },
              },
              yAxis: {
                type: "value",
                axisLabel: { color: chartTheme.text, fontSize: 10 },
                splitLine: { lineStyle: { color: chartTheme.line } },
              },
              series: [
                {
                  name: "Adet",
                  type: "bar",
                  data: metrics.salesByChannel.map((d) => d.count),
                  itemStyle: { color: "#38bdf8" },
                },
                {
                  name: "Gelir",
                  type: "line",
                  data: metrics.salesByChannel.map((d) => d.revenue),
                  lineStyle: { color: "#34d399" },
                  itemStyle: { color: "#34d399" },
                },
              ],
            }}
            style={{ height: 260 }}
          />
        </ChartCard>
      )}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass glass-hover rounded-2xl p-5 ${className ?? ""}`}>
      <div className="mb-3">
        <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
        {subtitle && <p className="text-xs text-zinc-600">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
