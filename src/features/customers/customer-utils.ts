import type { Customer, Job } from "@/types/database";

export type CustomerStats = {
  orderCount: number;
  totalRevenue: number;
  pendingCollection: number;
  lastOrderDate: string | null;
};

export function buildCustomerStatsMap(jobs: Job[]): Map<string, CustomerStats> {
  const map = new Map<string, CustomerStats>();

  for (const job of jobs) {
    if (!job.customer_id) continue;
    const prev = map.get(job.customer_id) ?? {
      orderCount: 0,
      totalRevenue: 0,
      pendingCollection: 0,
      lastOrderDate: null,
    };

    const revenue = job.revenue_amount ?? 0;
    const remaining = job.amount_remaining ?? 0;
    const last =
      !prev.lastOrderDate || job.job_date > prev.lastOrderDate
        ? job.job_date
        : prev.lastOrderDate;

    map.set(job.customer_id, {
      orderCount: prev.orderCount + 1,
      totalRevenue: prev.totalRevenue + revenue,
      pendingCollection: prev.pendingCollection + Math.max(0, remaining),
      lastOrderDate: last,
    });
  }

  return map;
}

export function matchesCustomerSearch(customer: Customer, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    customer.name,
    customer.company,
    customer.email,
    customer.phone,
    customer.source,
    customer.referral,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function formatContactLine(customer: Customer): string {
  const parts = [customer.email, customer.phone].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}
