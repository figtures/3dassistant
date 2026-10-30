import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderTabId } from "@/features/orders/order-constants";
import {
  parseMultiParam,
  tabToPaymentFilter,
  tabToStatusFilter,
} from "@/features/orders/order-utils";
import { todayIsoInIstanbul } from "@/lib/format";
import type { Customer, Job, JobStatus, PaymentStatus } from "@/types/database";

export const ORDERS_EXPORT_SELECT =
  "*, machine:machines(name), customer:customers(name), material:materials(name), material_color:material_colors(color_name)";

export type OrdersExportQueryParams = {
  tab?: OrderTabId;
  q?: string;
  status?: JobStatus[];
  payment?: PaymentStatus[];
  machineId?: string;
  customerId?: string;
  from?: string;
  to?: string;
};

export function parseOrdersExportSearchParams(
  searchParams: URLSearchParams
): OrdersExportQueryParams {
  const tabRaw = searchParams.get("tab");
  const tab =
    tabRaw === "pending" ||
    tabRaw === "in_progress" ||
    tabRaw === "overdue" ||
    tabRaw === "payment"
      ? tabRaw
      : "all";

  const jobStatuses: JobStatus[] = [
    "pending",
    "in_progress",
    "completed",
    "cancelled",
  ];
  const paymentStatuses: PaymentStatus[] = [
    "unpaid",
    "partial",
    "paid",
    "upcoming",
  ];

  return {
    tab,
    q: searchParams.get("q") ?? undefined,
    status: parseMultiParam(searchParams.get("status"), jobStatuses) as JobStatus[],
    payment: parseMultiParam(
      searchParams.get("payment"),
      paymentStatuses
    ) as PaymentStatus[],
    machineId: searchParams.get("machine") ?? undefined,
    customerId: searchParams.get("customer") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  };
}

function mergeStatusFilters(
  tab: OrderTabId,
  explicit?: JobStatus[]
): JobStatus[] | undefined {
  const fromTab = tabToStatusFilter(tab);
  if (fromTab?.length) return fromTab;
  if (explicit?.length) return explicit;
  return undefined;
}

function mergePaymentFilters(
  tab: OrderTabId,
  explicit?: PaymentStatus[]
): PaymentStatus[] | undefined {
  const fromTab = tabToPaymentFilter(tab);
  if (fromTab?.length) return fromTab;
  if (explicit?.length) return explicit;
  return undefined;
}

export function applyOrdersExportFilters<
  Q extends {
    eq: (col: string, val: string) => Q;
    in: (col: string, vals: string[]) => Q;
    gte: (col: string, val: string) => Q;
    lte: (col: string, val: string) => Q;
    lt: (col: string, val: string) => Q;
    ilike: (col: string, val: string) => Q;
  },
>(query: Q, params: OrdersExportQueryParams): Q {
  const tab = params.tab ?? "all";

  const statuses = mergeStatusFilters(tab, params.status);
  if (statuses?.length) {
    query = query.in("status", statuses);
  }

  const payments = mergePaymentFilters(tab, params.payment);
  if (payments?.length) {
    query = query.in("payment_status", payments);
  }

  if (params.machineId) {
    query = query.eq("machine_id", params.machineId);
  }
  if (params.customerId) {
    query = query.eq("customer_id", params.customerId);
  }
  if (params.from) {
    query = query.gte("delivery_date", params.from);
  }
  if (params.to) {
    query = query.lte("delivery_date", params.to);
  }

  if (tab === "overdue") {
    const today = todayIsoInIstanbul();
    query = query
      .lt("delivery_date", today)
      .in("status", ["pending", "in_progress"]);
  }

  const q = params.q?.trim();
  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  return query;
}

const PAGE_SIZE = 1000;

export async function fetchAllOrdersForExport(
  supabase: SupabaseClient,
  workspaceId: string,
  params: OrdersExportQueryParams
): Promise<{ rows: Job[]; total: number }> {
  let countQuery = supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", workspaceId);
  countQuery = applyOrdersExportFilters(countQuery, params);
  const { count, error: countError } = await countQuery;
  if (countError) throw countError;

  const total = count ?? 0;
  const rows: Job[] = [];
  const pages = Math.ceil(total / PAGE_SIZE);

  for (let page = 0; page < pages; page += 1) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from("jobs")
      .select(ORDERS_EXPORT_SELECT)
      .eq("user_id", workspaceId);
    query = applyOrdersExportFilters(query, params);
    const { data, error } = await query
      .order("job_date", { ascending: false })
      .range(from, to);
    if (error) throw error;
    rows.push(...((data ?? []) as Job[]));
  }

  return { rows, total };
}

export async function fetchAllCustomersForExport(
  supabase: SupabaseClient,
  workspaceId: string,
  q?: string
): Promise<Customer[]> {
  const rows: Customer[] = [];
  let from = 0;

  for (;;) {
    let query = supabase
      .from("customers")
      .select("*")
      .eq("user_id", workspaceId)
      .order("name", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    const trimmed = q?.trim();
    if (trimmed) {
      query = query.or(
        `name.ilike.%${trimmed}%,company.ilike.%${trimmed}%,email.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    const batch = (data ?? []) as Customer[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}
