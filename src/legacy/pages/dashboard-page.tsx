"use client";

import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { canViewFinance } from "@/lib/workspace/permissions";
import { useQueryClient } from "@tanstack/react-query";
import {
  useJobs,
  useDeliveryJobs,
  useMachines,
  useMaterials,
  useCustomers,
  useFaults,
  useMaterialPurchases,
  useCatalogItems,
  useCatalogSales,
  useShipmentStatusCounts,
  computeMetrics,
  mergeBusinessMetrics,
  getDefaultFilters,
} from "@/hooks/use-data";
import { DeliveryAlerts } from "@/components/dashboard/delivery-alerts";
import { MachineFleetPanel } from "@/components/dashboard/machine-fleet-panel";
import { JobModal } from "@/components/planning/job-modal";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconBox } from "@/components/ui/icon-box";
import { MetricSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatGrams, formatCurrency, formatDuration, cn } from "@/lib/utils";
import type { DashboardFilters, JobStatus, Job, Machine } from "@/types/database";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  ShoppingCart,
  LayoutGrid,
  AlertCircle,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Banknote,
  Receipt,
  CircleDollarSign,
  Timer,
} from "lucide-react";

const DashboardCharts = dynamic(
  () =>
    import("@/components/dashboard/dashboard-charts").then((m) => ({
      default: m.DashboardCharts,
    })),
  { ssr: false }
);

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: "pending", label: "Bekliyor" },
  { value: "in_progress", label: "Devam Ediyor" },
  { value: "completed", label: "Tamamlandı" },
  { value: "cancelled", label: "İptal" },
];

const METRICS = [
  { key: "totalJobs", label: "Toplam İş", icon: Briefcase, color: "sky", format: (v: number) => String(v) },
  { key: "completedJobs", label: "Tamamlanan", icon: CheckCircle2, color: "emerald", format: (v: number) => String(v) },
  { key: "pendingJobs", label: "Bekleyen", icon: Clock, color: "amber", format: (v: number) => String(v) },
  { key: "inProgressJobs", label: "Devam Eden", icon: Loader2, color: "indigo", format: (v: number) => String(v) },
  { key: "totalRevenue", label: "Toplam Kazanç", icon: Banknote, color: "emerald", format: (v: number) => formatCurrency(v) },
  { key: "totalMaterialCost", label: "Malzeme Maliyeti", icon: Receipt, color: "violet", format: (v: number) => formatCurrency(v) },
  { key: "netProfit", label: "Net Kar", icon: CircleDollarSign, color: "sky", format: (v: number) => formatCurrency(v) },
  { key: "totalDurationMinutes", label: "Toplam Süre", icon: Timer, color: "indigo", format: (v: number) => formatDuration(v) },
  { key: "totalGramsUsed", label: "Malzeme Kullanımı", icon: Package, color: "violet", format: (v: number) => formatGrams(v) },
] as const;

const colorMap = {
  sky: { tone: "primary" as const },
  emerald: { tone: "success" as const },
  amber: { tone: "warning" as const },
  indigo: { tone: "info" as const },
  violet: { tone: "info" as const },
};

export default function DashboardLegacyPage() {
  const queryClient = useQueryClient();
  const { role } = useWorkspace();
  const showFinance = canViewFinance(role);
  const financeMetricKeys = new Set([
    "totalRevenue",
    "totalMaterialCost",
    "netProfit",
  ]);
  const visibleMetrics = METRICS.filter(
    (m) => showFinance || !financeMetricKeys.has(m.key)
  );
  const [filters, setFilters] = useState<DashboardFilters>(getDefaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const { data: jobs = [], isLoading } = useJobs(filters);
  const { data: deliveryJobs = [], isLoading: deliveryLoading } = useDeliveryJobs();
  const { data: machines = [] } = useMachines({ live: true });
  const { data: materials = [] } = useMaterials();
  const { data: customers = [] } = useCustomers();
  const { data: faults = [] } = useFaults();
  const { data: purchases = [] } = useMaterialPurchases();
  const { data: catalogItems = [] } = useCatalogItems();
  const { data: sales = [] } = useCatalogSales();
  const { data: shipmentCounts } = useShipmentStatusCounts();

  const metrics = useMemo(() => {
    const base = computeMetrics(jobs, customers, faults);
    return mergeBusinessMetrics(base, purchases, catalogItems, sales);
  }, [jobs, customers, faults, purchases, catalogItems, sales]);

  const modalMachine: Machine | undefined = selectedJob
    ? (selectedJob.machine ?? machines.find((m) => m.id === selectedJob.machine_id))
    : undefined;

  function toggleArrayFilter<T extends string>(key: keyof DashboardFilters, value: T) {
    setFilters((prev) => {
      const arr = prev[key] as T[];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, [key]: next };
    });
  }

  const activeFilterCount =
    filters.machineIds.length +
    filters.materialIds.length +
    filters.customerIds.length +
    filters.statuses.length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="İş emirlerinizin performansını gerçek zamanlı takip edin."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-4 w-4" />
            Filtreler
            {activeFilterCount > 0 && (
              <Badge variant="primary" className="ml-1">{activeFilterCount}</Badge>
            )}
            {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        }
      />

      {showFilters && (
        <Card className="animate-fade-up">
          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Başlangıç</Label>
                <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Bitiş</Label>
                <Input type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Makine</Label>
                <Select value="" onChange={(e) => { if (e.target.value) toggleArrayFilter("machineIds", e.target.value); }}>
                  <option value="">Seçin...</option>
                  {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
                <FilterTags items={filters.machineIds.map((id) => machines.find((m) => m.id === id)?.name ?? id)} onRemove={(name) => { const id = machines.find((m) => m.name === name)?.id; if (id) toggleArrayFilter("machineIds", id); }} />
              </div>
              <div className="space-y-2">
                <Label>Malzeme</Label>
                <Select value="" onChange={(e) => { if (e.target.value) toggleArrayFilter("materialIds", e.target.value); }}>
                  <option value="">Seçin...</option>
                  {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
                <FilterTags items={filters.materialIds.map((id) => materials.find((m) => m.id === id)?.name ?? id)} onRemove={(name) => { const id = materials.find((m) => m.name === name)?.id; if (id) toggleArrayFilter("materialIds", id); }} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => toggleArrayFilter("statuses", value)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ring-1 ring-inset",
                    filters.statuses.includes(value)
                      ? "bg-sky-500/15 text-sky-400 ring-sky-500/30"
                      : "bg-zinc-800/60 text-zinc-500 ring-zinc-700/50 hover:text-zinc-300"
                  )}
                >
                  {label}
                </button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setFilters(getDefaultFilters())}>
                <RotateCcw className="h-3 w-3" />
                Sıfırla
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <MachineFleetPanel />

      {!deliveryLoading && (
        <DeliveryAlerts
          jobs={deliveryJobs}
          onSelectJob={setSelectedJob}
          showFinance={showFinance}
        />
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
          {Array.from({ length: 9 }).map((_, i) => <MetricSkeleton key={i} />)}
        </div>
      ) : metrics.totalJobs === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Henüz iş emri yok"
          description="Planlama ekranından ilk işinizi ekleyin veya filtre tarih aralığını genişletin."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
            {visibleMetrics.map(({ key, label, icon: Icon, color, format }) => {
              const c = colorMap[color];
              const value = metrics[key as keyof typeof metrics] as number;
              return (
                <div key={key} className="glass glass-hover rounded-2xl p-5">
                  <div className="flex items-center gap-3">
                    <IconBox icon={Icon} tone={c.tone} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-xs text-zinc-500">{label}</p>
                      <p className="text-lg font-semibold tracking-tight text-zinc-100">{format(value)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="glass glass-hover rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <IconBox icon={ShoppingCart} tone="warning" size="md" />
                <div>
                  <p className="text-xs text-zinc-500">Tedarik Harcaması</p>
                  <p className="text-lg font-semibold text-zinc-100">
                    {formatCurrency(metrics.procurementSpend)}
                  </p>
                </div>
              </div>
            </div>
            <div className="glass glass-hover rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <IconBox icon={LayoutGrid} tone="info" size="md" />
                <div>
                  <p className="text-xs text-zinc-500">Katalog Ürünleri</p>
                  <p className="text-lg font-semibold text-zinc-100">{metrics.catalogItemCount}</p>
                </div>
              </div>
            </div>
            {shipmentCounts && (
              <div className="glass glass-hover rounded-2xl p-5 sm:col-span-2 lg:col-span-3">
                <p className="text-xs text-zinc-500 mb-2">Kargo durumları</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {(
                    [
                      ["pending", "Bekliyor"],
                      ["shipped", "Kargolandı"],
                      ["in_transit", "Yolda"],
                      ["delivered", "Teslim"],
                      ["returned", "İade"],
                    ] as const
                  ).map(([key, label]) => (
                    <Badge key={key} variant={shipmentCounts[key] > 0 ? "primary" : "default"}>
                      {label}: {shipmentCounts[key]}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="glass glass-hover rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <IconBox icon={AlertCircle} tone="warning" size="md" />
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">Düşük Stok Uyarısı</p>
                  <p className="text-lg font-semibold text-zinc-100">
                    {metrics.lowStockCatalogItems.length} ürün
                  </p>
                  {metrics.lowStockCatalogItems.length > 0 && (
                    <p className="truncate text-[10px] text-zinc-500 mt-1">
                      {metrics.lowStockCatalogItems
                        .slice(0, 2)
                        .map((i) => i.sku)
                        .join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
      {showFinance ? (
          <DashboardCharts metrics={metrics} />
        ) : null}
        </>
      )}

      {selectedJob && modalMachine && (
        <JobModal
          open={!!selectedJob}
          onClose={() => setSelectedJob(null)}
          job={selectedJob}
          machine={modalMachine}
          date={selectedJob.job_date}
          materials={materials}
          customers={customers}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
            setSelectedJob(null);
          }}
        />
      )}
    </div>
  );
}

function FilterTags({ items, onRemove }: { items: string[]; onRemove: (item: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {items.map((item) => (
        <Badge key={item} variant="primary" className="gap-1 pr-1">
          {item}
          <button onClick={() => onRemove(item)} className="ml-0.5 rounded-full p-0.5 hover:bg-sky-500/20">×</button>
        </Badge>
      ))}
    </div>
  );
}
