"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Job, JobStatus, PaymentStatus } from "@/types/database";
import { todayIsoInIstanbul } from "@/lib/format";
import { useTenantId } from "@/components/workspace/workspace-provider";
import type { OrderTabId } from "@/features/orders/order-constants";
import {
  tabToPaymentFilter,
  tabToStatusFilter,
} from "@/features/orders/order-utils";

const JOB_SELECT =
  "*, machine:machines(*), customer:customers(*), material:materials(*), material_color:material_colors(*), job_notes(*)";

export type UseOrdersParams = {
  q?: string;
  tab?: OrderTabId;
  status?: JobStatus[];
  payment?: PaymentStatus[];
  machineId?: string;
  customerId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export type OrdersPage = {
  rows: Job[];
  total: number;
};

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

export function useOrders(params: UseOrdersParams) {
  const tenantId = useTenantId();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 25;
  const tab = params.tab ?? "all";

  return useQuery({
    queryKey: ["orders", tenantId, params],
    queryFn: async (): Promise<OrdersPage> => {
      const supabase = createClient();
      let query = supabase
        .from("jobs")
        .select(JOB_SELECT, { count: "exact" })
        .eq("user_id", tenantId);

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

      const fromIdx = (page - 1) * pageSize;
      const toIdx = fromIdx + pageSize - 1;

      const { data, error, count } = await query
        .order("job_date", { ascending: false })
        .range(fromIdx, toIdx);

      if (error) throw error;
      return { rows: (data ?? []) as Job[], total: count ?? 0 };
    },
  });
}

const BOARD_FETCH_LIMIT = 500;

export type UseOrdersBoardParams = {
  q?: string;
  machineId?: string;
  customerId?: string;
  from?: string;
  to?: string;
};

export function useOrdersBoard(params: UseOrdersBoardParams) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["orders-board", tenantId, params],
    queryFn: async (): Promise<Job[]> => {
      const supabase = createClient();
      let query = supabase.from("jobs").select(JOB_SELECT).eq("user_id", tenantId);

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

      const q = params.q?.trim();
      if (q) {
        query = query.ilike("title", `%${q}%`);
      }

      const { data, error } = await query
        .order("job_date", { ascending: false })
        .limit(BOARD_FETCH_LIMIT);

      if (error) throw error;
      return (data ?? []) as Job[];
    },
  });
}

export function useOrderById(orderId: string | null) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["order", tenantId, orderId],
    enabled: !!orderId && orderId !== "new",
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("jobs")
        .select(JOB_SELECT)
        .eq("user_id", tenantId)
        .eq("id", orderId!)
        .single();
      if (error) throw error;
      return data as Job;
    },
  });
}
