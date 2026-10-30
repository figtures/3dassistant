"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { STATUS_INCIDENTS, type StatusIncident } from "@/content/incidents";
import { StatusDayBar } from "@/features/status/status-day-bar";
import type { ServiceStatusSnapshot } from "@/lib/status/checks";
import { cn } from "@/lib/utils";

type Overall = "operational" | "degraded" | "down" | "unknown";

const OVERALL_META: Record<
  Overall,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  operational: {
    label: "Tüm sistemler çalışıyor",
    icon: CheckCircle2,
    className: "text-success",
  },
  degraded: {
    label: "Kısmi kesinti",
    icon: AlertTriangle,
    className: "text-warning",
  },
  down: {
    label: "Kesinti var",
    icon: XCircle,
    className: "text-destructive",
  },
  unknown: {
    label: "Durum verisi toplanıyor",
    icon: HelpCircle,
    className: "text-muted-foreground",
  },
};

type StatusPageScreenProps = {
  overall: Overall;
  services: ServiceStatusSnapshot[];
  incidents: StatusIncident[];
};

function formatCheckedAt(iso: string | null): string {
  if (!iso) return "Henüz kontrol yok";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function StatusPageScreen({ overall, services, incidents }: StatusPageScreenProps) {
  const meta = OVERALL_META[overall];
  const Icon = meta.icon;
  const [selectedByService, setSelectedByService] = useState<Record<string, string | null>>(
    {}
  );

  const openIncidents = useMemo(
    () => incidents.filter((i) => !i.resolvedAt),
    [incidents]
  );

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16">
      <header className="space-y-4 border-b border-border pb-8">
        <p className="text-sm font-medium text-muted-foreground">3D Asisstant</p>
        <div className="flex items-start gap-3">
          <Icon className={cn("mt-0.5 size-8 shrink-0", meta.className)} aria-hidden />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Sistem durumu
            </h1>
            <p className={cn("text-lg font-medium", meta.className)}>{meta.label}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Son 90 günlük çalışma süresi. Veriler zamanlanmış görevler ve sağlık kontrollerinden
          otomatik toplanır; sayfa yaklaşık her dakika yenilenir.
        </p>
      </header>

      {openIncidents.length > 0 ? (
        <section aria-labelledby="incidents-heading" className="space-y-3">
          <h2 id="incidents-heading" className="text-lg font-semibold text-foreground">
            Devam eden olaylar
          </h2>
          <ul className="space-y-3">
            {openIncidents.map((incident) => (
              <li
                key={incident.id}
                className="rounded-xl border border-warning/40 bg-warning-subtle/30 p-4"
              >
                <h3 className="font-medium text-foreground">{incident.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{incident.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="services-heading" className="space-y-8">
        <h2 id="services-heading" className="sr-only">
          Servisler
        </h2>
        {services.map((service) => {
          const currentLabel =
            service.currentOk === null
              ? "Bekleniyor"
              : service.currentOk
                ? "Çalışıyor"
                : "Sorunlu";
          const currentClass =
            service.currentOk === null
              ? "text-muted-foreground"
              : service.currentOk
                ? "text-success"
                : "text-destructive";

          return (
            <article
              key={service.service}
              className="rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Activity className="size-4 text-primary" aria-hidden />
                    {service.label}
                  </h3>
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                </div>
                <div className="text-right text-sm">
                  <p className={cn("font-medium", currentClass)}>{currentLabel}</p>
                  <p className="text-muted-foreground">
                    Son kontrol: {formatCheckedAt(service.lastCheckedAt)}
                  </p>
                  {service.uptimePercent90d != null ? (
                    <p className="text-muted-foreground">
                      90 gün: %{service.uptimePercent90d} sorunsuz gün
                    </p>
                  ) : null}
                </div>
              </div>
              <StatusDayBar
                bars={service.dailyBars}
                serviceLabel={service.label}
                selectedDate={selectedByService[service.service] ?? null}
                onSelectDate={(date) =>
                  setSelectedByService((prev) => ({
                    ...prev,
                    [service.service]: date,
                  }))
                }
              />
            </article>
          );
        })}
      </section>

      {incidents.some((i) => i.resolvedAt) ? (
        <section aria-labelledby="past-incidents" className="space-y-3">
          <h2 id="past-incidents" className="text-lg font-semibold text-foreground">
            Geçmiş olaylar
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {incidents
              .filter((i) => i.resolvedAt)
              .map((i) => (
                <li key={i.id}>
                  <span className="font-medium text-foreground">{i.title}</span>
                  {" — "}
                  {i.resolvedAt?.slice(0, 10)}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
        <p>
          Sorun mu yaşıyorsunuz?{" "}
          <Link href="/support" className="text-primary hover:underline">
            Destek talebi oluşturun
          </Link>{" "}
          veya oturum açmış kullanıcılar üst bardaki yardım menüsünden &quot;Sorun bildir&quot;
          seçeneğini kullanın.
        </p>
        <p className="mt-2">
          <Link href="/" className="text-primary hover:underline">
            Ana sayfa
          </Link>
        </p>
      </footer>
    </div>
  );
}
