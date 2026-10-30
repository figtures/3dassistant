import type { SupabaseClient } from "@supabase/supabase-js";

export const STATUS_SERVICES = ["app", "cloud_sync", "bridge", "email"] as const;
export type StatusService = (typeof STATUS_SERVICES)[number];

export type StatusCheckRow = {
  service: StatusService;
  ok: boolean;
  latency_ms: number | null;
  checked_at: string;
};

export type DayUptimeState = "operational" | "degraded" | "down" | "unknown";

export type DailyUptimeBar = {
  date: string;
  state: DayUptimeState;
  totalChecks: number;
  failedChecks: number;
};

export type ServiceStatusSnapshot = {
  service: StatusService;
  label: string;
  description: string;
  currentOk: boolean | null;
  lastCheckedAt: string | null;
  lastLatencyMs: number | null;
  uptimePercent90d: number | null;
  dailyBars: DailyUptimeBar[];
};

export const STATUS_SERVICE_META: Record<
  StatusService,
  { label: string; description: string }
> = {
  app: {
    label: "Uygulama",
    description: "3D Assistant web uygulaması ve API uç noktaları.",
  },
  cloud_sync: {
    label: "Bulut yazıcı senkronu",
    description: "Üretici bulut hesaplarından yazıcı durumu çekme (zamanlanmış görev).",
  },
  bridge: {
    label: "Köprü bağlantısı",
    description: "Atölye köprüsü relay servisi (LAN yazıcıları için).",
  },
  email: {
    label: "E-posta",
    description: "Hatırlatma ve bildirim e-postalarının gönderimi.",
  },
};

export const STATUS_HISTORY_DAYS = 90;

const DAY_MS = 86_400_000;

function utcDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Son N takvim günü (UTC), en eskiden en yeniye. */
export function buildUtcDayRange(dayCount: number, now: Date): string[] {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days: string[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    days.push(new Date(end - i * DAY_MS).toISOString().slice(0, 10));
  }
  return days;
}

export function dayStateFromChecks(checks: StatusCheckRow[]): DayUptimeState {
  if (checks.length === 0) return "unknown";
  const failed = checks.filter((c) => !c.ok).length;
  if (failed === 0) return "operational";
  if (failed === checks.length) return "down";
  return "degraded";
}

export function aggregateChecksToDailyBars(
  checks: StatusCheckRow[],
  dayCount: number,
  now: Date
): DailyUptimeBar[] {
  const byDay = new Map<string, StatusCheckRow[]>();
  for (const row of checks) {
    const key = utcDateKey(row.checked_at);
    const list = byDay.get(key);
    if (list) list.push(row);
    else byDay.set(key, [row]);
  }

  return buildUtcDayRange(dayCount, now).map((date) => {
    const dayChecks = byDay.get(date) ?? [];
    const failedChecks = dayChecks.filter((c) => !c.ok).length;
    return {
      date,
      state: dayStateFromChecks(dayChecks),
      totalChecks: dayChecks.length,
      failedChecks,
    };
  });
}

export function uptimePercentFromDailyBars(bars: DailyUptimeBar[]): number | null {
  const withData = bars.filter((b) => b.state !== "unknown");
  if (withData.length === 0) return null;
  const good = withData.filter((b) => b.state === "operational").length;
  return Math.round((good / withData.length) * 1000) / 10;
}

export function buildServiceSnapshots(
  rows: StatusCheckRow[],
  now: Date,
  dayCount = STATUS_HISTORY_DAYS
): ServiceStatusSnapshot[] {
  const byService = new Map<StatusService, StatusCheckRow[]>();
  for (const service of STATUS_SERVICES) {
    byService.set(service, []);
  }
  for (const row of rows) {
    if (!STATUS_SERVICES.includes(row.service as StatusService)) continue;
    byService.get(row.service as StatusService)!.push(row);
  }

  return STATUS_SERVICES.map((service) => {
    const serviceRows = [...(byService.get(service) ?? [])].sort(
      (a, b) => b.checked_at.localeCompare(a.checked_at)
    );
    const latest = serviceRows[0];
    const dailyBars = aggregateChecksToDailyBars(serviceRows, dayCount, now);
    const meta = STATUS_SERVICE_META[service];
    return {
      service,
      label: meta.label,
      description: meta.description,
      currentOk: latest ? latest.ok : null,
      lastCheckedAt: latest?.checked_at ?? null,
      lastLatencyMs: latest?.latency_ms ?? null,
      uptimePercent90d: uptimePercentFromDailyBars(dailyBars),
      dailyBars,
    };
  });
}

export function overallPageStatus(
  services: ServiceStatusSnapshot[]
): "operational" | "degraded" | "down" | "unknown" {
  const known = services.filter((s) => s.currentOk !== null);
  if (known.length === 0) return "unknown";
  if (known.every((s) => s.currentOk)) return "operational";
  if (known.every((s) => s.currentOk === false)) return "down";
  return "degraded";
}

export async function fetchStatusCheckRows(
  supabase: SupabaseClient,
  since: Date
): Promise<StatusCheckRow[]> {
  const { data, error } = await supabase
    .from("status_checks")
    .select("service, ok, latency_ms, checked_at")
    .gte("checked_at", since.toISOString())
    .order("checked_at", { ascending: true });

  if (error) {
    console.error("[status/checks] fetch failed", error.message);
    return [];
  }

  return (data ?? []) as StatusCheckRow[];
}

export async function recordStatusCheck(
  supabase: SupabaseClient,
  input: {
    service: StatusService;
    ok: boolean;
    latencyMs?: number | null;
    checkedAt?: string;
  }
): Promise<void> {
  const { error } = await supabase.from("status_checks").insert({
    service: input.service,
    ok: input.ok,
    latency_ms: input.latencyMs ?? null,
    checked_at: input.checkedAt ?? new Date().toISOString(),
  });
  if (error) {
    console.error("[status/checks] insert failed", input.service, error.message);
  }
}
