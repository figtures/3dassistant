"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, HeartPulse, Loader2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Skeleton,
} from "@/components/ds";
import { PLANS } from "@/lib/billing/plans";
import {
  HEALTH_BAND_LABELS,
  sortTenantHealthRows,
  type HealthBand,
  type HealthSortKey,
  type TenantHealthRow,
} from "@/lib/support/health-score";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  trialing: "Deneme",
  active: "Aktif",
  past_due: "Ödeme gecikmiş",
  canceled: "İptal",
  paused: "Duraklatıldı",
};

function bandTone(band: HealthBand): "success" | "warning" | "danger" {
  if (band === "green") return "success";
  if (band === "yellow") return "warning";
  return "danger";
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type SortState = { key: HealthSortKey; direction: "asc" | "desc" };

const DEFAULT_SORT: SortState = { key: "score", direction: "asc" };

const COLUMNS: Array<{ key: HealthSortKey; label: string; className?: string }> = [
  { key: "score", label: "Skor", className: "w-24" },
  { key: "name", label: "Kiracı" },
  { key: "lastSignInAt", label: "Son giriş" },
  { key: "connectedMachineCount", label: "Bağlı makine", className: "text-right" },
  { key: "ordersLast7Days", label: "Sipariş (7g)", className: "text-right" },
  { key: "clientErrorCount7d", label: "Hata (7g)", className: "text-right" },
  { key: "openSupportTickets", label: "Açık talep", className: "text-right" },
  { key: "planKey", label: "Plan" },
  { key: "lastNpsScore", label: "NPS", className: "text-right w-16" },
];

function SortIcon({ active, direction }: { active: boolean; direction: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />;
  return direction === "asc" ? (
    <ArrowUp className="size-3.5" aria-hidden />
  ) : (
    <ArrowDown className="size-3.5" aria-hidden />
  );
}

export function AdminHealthScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TenantHealthRow[]>([]);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [selected, setSelected] = useState<TenantHealthRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/support/admin/health");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Sağlık verisi alınamadı");
        return;
      }
      const body = await res.json();
      setRows(body.tenants ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () => sortTenantHealthRows(rows, sort.key, sort.direction),
    [rows, sort]
  );

  function toggleSort(key: HealthSortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "score" ? "asc" : "desc" }
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <HeartPulse className="size-6" aria-hidden />
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Müşteri sağlığı
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Kiracı başına aktivite, kullanım ve destek sinyalleri — risktekiler üstte.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            Yenile
          </Button>
          <Link
            href="/support/admin"
            className="inline-flex h-8 items-center rounded-lg border border-input bg-background px-3 text-sm hover:bg-accent"
          >
            ← Destek yönetimi
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="Kiracı bulunamadı"
                description="Henüz çalışma alanı kaydı yok veya service role yapılandırması eksik."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    {COLUMNS.map((col) => (
                      <th key={col.key} className={cn("px-3 py-2.5 font-medium", col.className)}>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] rounded-sm"
                          onClick={() => toggleSort(col.key)}
                        >
                          {col.label}
                          <SortIcon active={sort.key === col.key} direction={sort.direction} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => (
                    <tr
                      key={row.workspaceId}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                      onClick={() => setSelected(row)}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-semibold tabular-nums">{row.score}</span>
                          <Badge tone={bandTone(row.band)}>{HEALTH_BAND_LABELS[row.band]}</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-foreground">{row.name}</div>
                        {row.ownerEmail && (
                          <div className="text-xs text-muted-foreground">{row.ownerEmail}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                        {formatDateTime(row.lastSignInAt)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {row.connectedMachineCount}
                        <span className="text-muted-foreground"> / {row.totalMachineCount}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {row.ordersLast7Days}
                        <span className="text-xs text-muted-foreground"> ({row.ordersLast30Days}/30g)</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{row.clientErrorCount7d}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{row.openSupportTickets}</td>
                      <td className="px-3 py-2.5">
                        <span>{PLANS[row.planKey].name}</span>
                        {row.subscriptionStatus && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({SUBSCRIPTION_STATUS_LABELS[row.subscriptionStatus] ?? row.subscriptionStatus})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {row.lastNpsScore ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent
          size="lg"
          className="sm:left-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:w-full sm:max-w-lg sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:rounded-l-2xl"
        >
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>
                  Sağlık skoru {selected.score} · {HEALTH_BAND_LABELS[selected.band]}
                  {selected.ownerEmail ? ` · ${selected.ownerEmail}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[calc(100dvh-8rem)] space-y-4 overflow-y-auto overscroll-contain py-1 text-sm">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Son giriş</dt>
                    <dd>{formatDateTime(selected.lastSignInAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Bağlı makine</dt>
                    <dd>
                      {selected.connectedMachineCount} / {selected.totalMachineCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Sipariş (7 / 30 gün)</dt>
                    <dd>
                      {selected.ordersLast7Days} / {selected.ordersLast30Days}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">İstemci hatası (7 gün)</dt>
                    <dd>{selected.clientErrorCount7d}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Açık destek</dt>
                    <dd>{selected.openSupportTickets}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Plan</dt>
                    <dd>
                      {PLANS[selected.planKey].name}
                      {selected.subscriptionStatus
                        ? ` · ${SUBSCRIPTION_STATUS_LABELS[selected.subscriptionStatus] ?? selected.subscriptionStatus}`
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Son NPS</dt>
                    <dd>
                      {selected.lastNpsScore ?? "—"}
                      {selected.lastNpsAt ? ` (${formatDateTime(selected.lastNpsAt)})` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">UI sürümü</dt>
                    <dd>{selected.uiVersion ?? "varsayılan"}</dd>
                  </div>
                </dl>

                {selected.factors.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Skor etkileri
                    </h3>
                    <ul className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
                      {selected.factors.map((f) => (
                        <li key={f.key} className="flex justify-between gap-2 text-xs">
                          <span>{f.label}</span>
                          <span className="font-mono text-destructive">{f.delta}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Kiracı kimliği:{" "}
                  <span className="font-mono text-foreground">{selected.workspaceId}</span>
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
