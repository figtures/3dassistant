"use client";

/**
 * 21st referans (KPI / iskelet grid): Stat Cards Skeleton
 * https://21st.dev/@felipemenezes098/components/skeleton-10
 */
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Briefcase,
  Cpu,
  Package,
} from "lucide-react";
import type { DashboardKpis } from "@/features/dashboard/use-dashboard-kpis";
import { cn } from "@/lib/utils";

type KpiDef = {
  key: keyof Pick<
    DashboardKpis,
    "activeJobs" | "printingMachines" | "overdueOrders" | "criticalStock"
  >;
  label: string;
  icon: LucideIcon;
  href: string;
  accentClass: string;
  warnWhenPositive?: boolean;
};

const KPI_ITEMS: KpiDef[] = [
  {
    key: "activeJobs",
    label: "Aktif işler",
    icon: Briefcase,
    href: "/planning",
    accentClass: "text-primary",
  },
  {
    key: "printingMachines",
    label: "Baskıda makine",
    icon: Cpu,
    href: "/machines",
    accentClass: "text-[var(--state-printing)]",
  },
  {
    key: "overdueOrders",
    label: "Geciken sipariş",
    icon: AlertTriangle,
    href: "/calendar",
    accentClass: "text-[var(--state-error)]",
    warnWhenPositive: true,
  },
  {
    key: "criticalStock",
    label: "Kritik stok",
    icon: Package,
    href: "/materials?stock=critical",
    accentClass: "text-[var(--state-paused)]",
    warnWhenPositive: true,
  },
];

export function KpiRowSkeleton() {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-busy="true"
      aria-label="Metrikler yükleniyor"
    >
      {KPI_ITEMS.map(({ key }) => (
        <div
          key={key}
          className="rounded-xl border border-border bg-card p-4 motion-reduce:animate-none animate-pulse"
        >
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="mt-3 h-8 w-12 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

type KpiRowProps = {
  kpis: DashboardKpis;
};

export function KpiRow({ kpis }: KpiRowProps) {
  return (
    <section
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-labelledby="dashboard-kpi-heading"
    >
      <h2 id="dashboard-kpi-heading" className="sr-only">
        Özet metrikler
      </h2>
      {KPI_ITEMS.map(({ key, label, icon: Icon, href, accentClass, warnWhenPositive }) => {
        const value = kpis[key];
        const highlight = warnWhenPositive && value > 0;
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              "group rounded-xl border border-border bg-card p-4 transition-colors",
              "hover:border-border-strong hover:bg-surface-2",
              "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon
                className={cn("size-4 shrink-0 opacity-70", accentClass)}
                aria-hidden
              />
            </div>
            <p
              className={cn(
                "mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground",
                highlight && "text-[var(--state-error)]"
              )}
            >
              {value}
            </p>
          </Link>
        );
      })}
    </section>
  );
}
