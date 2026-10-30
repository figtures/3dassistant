import type { PlanKey } from "@/lib/billing/plans";
import { isEntitledStatus } from "@/lib/billing/plans";

export type HealthBand = "green" | "yellow" | "red";

export type TenantHealthInputs = {
  lastSignInAt: string | null;
  connectedMachineCount: number;
  totalMachineCount: number;
  ordersLast7Days: number;
  ordersLast30Days: number;
  clientErrorCount7d: number;
  openSupportTickets: number;
  planKey: PlanKey;
  subscriptionStatus: string | null;
  lastNpsScore: number | null;
  /** Testler ve deterministik skor için (varsayılan: şimdi). */
  now?: Date;
};

export type HealthFactor = {
  key: string;
  label: string;
  delta: number;
};

export type TenantHealthResult = {
  score: number;
  band: HealthBand;
  factors: HealthFactor[];
};

export const HEALTH_BAND_LABELS: Record<HealthBand, string> = {
  green: "İyi",
  yellow: "Dikkat",
  red: "Risk",
};

export function healthBandFromScore(score: number): HealthBand {
  if (score >= 70) return "green";
  if (score >= 40) return "yellow";
  return "red";
}

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / (24 * 60 * 60 * 1000);
}

/** Kiracı girdilerinden 0–100 sağlık skoru ve renk bandı üretir. */
export function computeHealthScore(input: TenantHealthInputs): TenantHealthResult {
  const now = input.now ?? new Date();
  const factors: HealthFactor[] = [];
  let score = 100;

  const push = (key: string, label: string, delta: number) => {
    if (delta === 0) return;
    score += delta;
    factors.push({ key, label, delta });
  };

  const inactiveDays = daysSince(input.lastSignInAt, now);
  if (inactiveDays === null) {
    push("sign_in", "Son giriş bilinmiyor", -20);
  } else if (inactiveDays > 30) {
    push("sign_in", "30 günden uzun süredir giriş yok", -35);
  } else if (inactiveDays > 14) {
    push("sign_in", "14–30 gün arası giriş yok", -20);
  } else if (inactiveDays > 7) {
    push("sign_in", "7–14 gün arası giriş yok", -10);
  }

  if (input.ordersLast30Days === 0) {
    push("orders", "Son 30 günde sipariş yok", -25);
  } else if (input.ordersLast7Days === 0) {
    push("orders", "Son 7 günde sipariş yok", -8);
  }

  if (input.totalMachineCount > 0 && input.connectedMachineCount === 0) {
    push("machines", "Bağlı makine yok", -15);
  }

  if (input.clientErrorCount7d > 0) {
    const penalty = Math.min(30, input.clientErrorCount7d * 2);
    push("errors", `Son 7 günde ${input.clientErrorCount7d} istemci hatası`, -penalty);
  }

  if (input.openSupportTickets > 0) {
    const penalty = Math.min(25, input.openSupportTickets * 10);
    push("tickets", `${input.openSupportTickets} açık destek talebi`, -penalty);
  }

  if (input.planKey !== "free" && input.subscriptionStatus) {
    if (input.subscriptionStatus === "canceled") {
      push("billing", "Abonelik iptal edilmiş", -20);
    } else if (input.subscriptionStatus === "paused") {
      push("billing", "Abonelik duraklatılmış", -15);
    } else if (input.subscriptionStatus === "past_due") {
      push("billing", "Ödeme gecikmiş", -10);
    } else if (!isEntitledStatus(input.subscriptionStatus)) {
      push("billing", "Abonelik aktif değil", -15);
    }
  }

  if (input.lastNpsScore === null) {
    push("nps", "NPS yanıtı yok", -5);
  } else if (input.lastNpsScore <= 6) {
    push("nps", `Düşük NPS (${input.lastNpsScore})`, -15);
  } else if (input.lastNpsScore <= 8) {
    push("nps", `Orta NPS (${input.lastNpsScore})`, -5);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    band: healthBandFromScore(score),
    factors,
  };
}

export type TenantHealthRow = {
  workspaceId: string;
  name: string;
  ownerEmail: string | null;
  lastSignInAt: string | null;
  connectedMachineCount: number;
  totalMachineCount: number;
  ordersLast7Days: number;
  ordersLast30Days: number;
  clientErrorCount7d: number;
  openSupportTickets: number;
  planKey: PlanKey;
  subscriptionStatus: string | null;
  lastNpsScore: number | null;
  lastNpsAt: string | null;
  uiVersion: "v1" | "v2" | null;
  score: number;
  band: HealthBand;
  factors: HealthFactor[];
};

export type HealthSortKey =
  | "score"
  | "name"
  | "lastSignInAt"
  | "connectedMachineCount"
  | "ordersLast7Days"
  | "clientErrorCount7d"
  | "openSupportTickets"
  | "planKey"
  | "lastNpsScore";

/** Risktekiler üstte: varsayılan skor artan. */
export function sortTenantHealthRows(
  rows: TenantHealthRow[],
  key: HealthSortKey,
  direction: "asc" | "desc"
): TenantHealthRow[] {
  const dir = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (key === "lastSignInAt") {
      const at = av ? Date.parse(String(av)) : 0;
      const bt = bv ? Date.parse(String(bv)) : 0;
      return (at - bt) * dir;
    }
    if (key === "name" || key === "planKey") {
      return String(av).localeCompare(String(bv), "tr") * dir;
    }
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * dir;
    }
    return 0;
  });
}
