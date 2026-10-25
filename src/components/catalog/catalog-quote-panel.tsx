"use client";

import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  MATERIAL_DENSITY_PRESETS,
  estimatePrintMinutes,
  estimateWeightGrams,
  type MeshMetrics,
} from "@/lib/mesh-metrics";
import { Ruler, Scale, Box, Clock, Layers } from "lucide-react";

interface CatalogQuotePanelProps {
  metrics: MeshMetrics | null;
  loading?: boolean;
  densityId: string;
  onDensityChange: (id: string) => void;
  materialLabel?: string;
}

function fmt(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("tr-TR", { maximumFractionDigits: digits });
}

export function CatalogQuotePanel({
  metrics,
  loading,
  densityId,
  onDensityChange,
  materialLabel,
}: CatalogQuotePanelProps) {
  const preset =
    MATERIAL_DENSITY_PRESETS.find((p) => p.id === densityId) ??
    MATERIAL_DENSITY_PRESETS[0];
  const weightG = metrics ? estimateWeightGrams(metrics.volumeCm3, preset.densityGcm3) : null;
  const printMin = metrics ? estimatePrintMinutes(metrics.volumeCm3) : null;

  return (
    <div className="catalog-editorial-panel flex flex-col gap-4 p-5">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-sky-400/80">
          Teklif & metrik
        </p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-50">Baskı hesabı</h2>
        {materialLabel && (
          <p className="mt-1 text-xs text-zinc-500">Varsayılan malzeme: {materialLabel}</p>
        )}
      </div>

      <FormDensity densityId={densityId} onDensityChange={onDensityChange} />

      {loading && (
        <p className="text-sm text-zinc-500 animate-pulse">Mesh analiz ediliyor…</p>
      )}

      {!loading && !metrics && (
        <p className="text-sm text-zinc-500">
          STL yüklendiğinde hacim, boyut ve tahmini ağırlık burada görünür.
        </p>
      )}

      {metrics && (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Metric
            icon={Box}
            label="Hacim"
            value={`${fmt(metrics.volumeCm3)} cm³`}
          />
          <Metric
            icon={Scale}
            label="Tahmini ağırlık"
            value={weightG != null ? `${fmt(weightG, 1)} g` : "—"}
          />
          <Metric
            icon={Ruler}
            label="Boyut (G×Y×D)"
            value={`${fmt(metrics.boundingBox.widthCm)} × ${fmt(metrics.boundingBox.heightCm)} × ${fmt(metrics.boundingBox.depthCm)} cm`}
            className="col-span-2"
          />
          <Metric
            icon={Layers}
            label="Üçgen"
            value={metrics.triangleCount.toLocaleString("tr-TR")}
          />
          <Metric
            icon={Clock}
            label="Tahmini süre"
            value={printMin != null ? `~${printMin} dk` : "—"}
            hint="Kaba tahmin"
          />
        </dl>
      )}

      <p className="text-[10px] leading-relaxed text-zinc-600">
        Hacim kapalı STL mesh için signed tetrahedron yöntemiyle hesaplanır. STL birimi mm
        kabul edilir. Ağırlık seçilen yoğunluğa göre tahminidir.
      </p>
    </div>
  );
}

function FormDensity({
  densityId,
  onDensityChange,
}: {
  densityId: string;
  onDensityChange: (id: string) => void;
}) {
  return (
    <label className="block text-xs text-zinc-400">
      Malzeme yoğunluğu (g/cm³)
      <Select
        className="mt-1.5"
        value={densityId}
        onChange={(e) => onDensityChange(e.target.value)}
      >
        {MATERIAL_DENSITY_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label} · {p.densityGcm3} g/cm³
          </option>
        ))}
      </Select>
    </label>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  className,
}: {
  icon: typeof Box;
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5 ${className ?? ""}`}
    >
      <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
        <Icon className="h-3 w-3 text-sky-400/70" />
        {label}
      </dt>
      <dd className="mt-1 font-medium text-zinc-100">{value}</dd>
      {hint && (
        <Badge variant="default" className="mt-1 text-[9px]">
          {hint}
        </Badge>
      )}
    </div>
  );
}
