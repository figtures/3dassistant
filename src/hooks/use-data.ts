"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  Job,
  DashboardFilters,
  DashboardMetrics,
  Customer,
  Fault,
  FaultType,
  MaterialColor,
  Supplier,
  MaterialPurchase,
  CatalogItem,
  CatalogItemJob,
  Sale,
  CatalogEvent,
  ShipmentStatus,
  Machine,
} from "@/types/database";
import { format, subDays, addDays, parseISO, eachDayOfInterval } from "date-fns";
import { tr } from "date-fns/locale";

export function useJobs(filters?: Partial<DashboardFilters>) {
  return useQuery({
    queryKey: ["jobs", filters],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from("jobs")
        .select("*, machine:machines(*), customer:customers(*), material:materials(*), material_color:material_colors(*)");

      if (filters?.dateFrom && filters?.dateField === "delivery_date") {
        query = query.gte("delivery_date", filters.dateFrom);
      } else if (filters?.dateFrom) {
        query = query.gte("job_date", filters.dateFrom);
      }

      if (filters?.dateTo && filters?.dateField === "delivery_date") {
        query = query.lte("delivery_date", filters.dateTo);
      } else if (filters?.dateTo) {
        query = query.lte("job_date", filters.dateTo);
      }
      if (filters?.machineIds?.length)
        query = query.in("machine_id", filters.machineIds);
      if (filters?.materialIds?.length)
        query = query.in("material_id", filters.materialIds);
      if (filters?.customerIds?.length)
        query = query.in("customer_id", filters.customerIds);
      if (filters?.statuses?.length)
        query = query.in("status", filters.statuses);

      const { data, error } = await query.order("job_date", { ascending: false });
      if (error) throw error;
      return data as Job[];
    },
  });
}

/** Teslim uyarıları için — aktif işler, geniş tarih aralığı */
export function useDeliveryJobs() {
  const dateFrom = format(subDays(new Date(), 90), "yyyy-MM-dd");
  const dateTo = format(addDays(new Date(), 60), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["jobs", "delivery", dateFrom, dateTo],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("jobs")
        .select("*, machine:machines(*), customer:customers(*), material:materials(*), material_color:material_colors(*)")
        .not("delivery_date", "is", null)
        .gte("delivery_date", dateFrom)
        .lte("delivery_date", dateTo)
        .in("status", ["pending", "in_progress"])
        .order("delivery_date", { ascending: true });

      if (error) throw error;
      return data as Job[];
    },
  });
}

export function useMaterials() {
  return useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("materials")
        .select("*, material_colors(*)")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((m) => ({
        ...m,
        material_colors: (m.material_colors ?? []).sort(
          (a: MaterialColor, b: MaterialColor) => a.sort_order - b.sort_order
        ),
      }));
    },
  });
}

const MACHINE_SELECT = `
  *,
  machine_connection:machine_connections(
    id,
    machine_id,
    adapter_type,
    base_url,
    enabled,
    last_test_ok,
    last_test_at
  ),
  machine_cloud_link:machine_cloud_links(
    id,
    machine_id,
    external_device_id,
    external_device_name,
    enabled,
    integration_account:printer_integration_accounts(
      id,
      vendor,
      display_name,
      status,
      last_sync_at
    )
  ),
  bridge_binding:bridge_machine_bindings(
    id,
    machine_id,
    vendor,
    device_serial,
    lan_host,
    device_label,
    last_push_at,
    bridge:workshop_bridges(id, label, last_seen_at)
  )
`;

function normalizeMachineRow(row: Record<string, unknown>): Machine {
  const bb = row.bridge_binding;
  const binding = Array.isArray(bb) ? bb[0] ?? null : bb;
  return { ...row, bridge_binding: binding } as Machine;
}

export function useMachines(options?: { live?: boolean }) {
  return useQuery({
    queryKey: ["machines"],
    refetchInterval: options?.live ? 10_000 : false,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("machines")
        .select(MACHINE_SELECT)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).map((row) => normalizeMachineRow(row as Record<string, unknown>));
    },
  });
}

export function useMachine(machineId: string, options?: { live?: boolean }) {
  return useQuery({
    queryKey: ["machines", machineId],
    refetchInterval: options?.live ? 5_000 : false,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("machines")
        .select(MACHINE_SELECT)
        .eq("id", machineId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return normalizeMachineRow(data as Record<string, unknown>);
    },
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function useCustomerJobs(customerId: string | null) {
  return useQuery({
    queryKey: ["jobs", "customer", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("jobs")
        .select(
          "*, machine:machines(*), material:materials(*), material_color:material_colors(*), job_notes(*)"
        )
        .eq("customer_id", customerId!)
        .order("job_date", { ascending: false });
      if (error) throw error;
      return data as Job[];
    },
  });
}

export function useFaultTypes() {
  return useQuery({
    queryKey: ["fault_types"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("fault_types")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as FaultType[];
    },
  });
}

export function useFaults() {
  return useQuery({
    queryKey: ["faults"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("faults")
        .select("*, machine:machines(*), fault_type:fault_types(*)")
        .order("fault_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Fault[];
    },
  });
}

export function computeMetrics(jobs: Job[], customers: Customer[] = [], faults: Fault[] = []): DashboardMetrics {
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((j) => j.status === "completed").length;
  const pendingJobs = jobs.filter((j) => j.status === "pending").length;
  const inProgressJobs = jobs.filter((j) => j.status === "in_progress").length;
  const totalGramsUsed = jobs.reduce((s, j) => s + (j.grams_used ?? 0), 0);
  const totalDurationMinutes = jobs.reduce((s, j) => s + (j.duration_minutes ?? 0), 0);

  const totalMaterialCost = jobs.reduce((s, j) => {
    if (!j.grams_used || !j.material?.price_per_kg) return s;
    return s + (j.grams_used / 1000) * j.material.price_per_kg;
  }, 0);

  const totalRevenue = jobs.reduce((s, j) => s + (j.revenue_amount ?? 0), 0);
  const netProfit = totalRevenue - totalMaterialCost;

  const dateMap = new Map<string, number>();
  const gramDateMap = new Map<string, number>();
  const revenueDateMap = new Map<string, number>();
  const durationDateMap = new Map<string, number>();
  const machineMap = new Map<string, number>();
  const materialMap = new Map<string, number>();
  const paymentMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  const faultMachineMap = new Map<string, number>();

  const PAYMENT_LABELS: Record<string, string> = {
    unpaid: "Ödenmedi",
    partial: "Kısmi",
    paid: "Ödendi",
    upcoming: "Bekleyen",
  };

  for (const job of jobs) {
    dateMap.set(job.job_date, (dateMap.get(job.job_date) ?? 0) + 1);
    gramDateMap.set(
      job.job_date,
      (gramDateMap.get(job.job_date) ?? 0) + (job.grams_used ?? 0)
    );
    revenueDateMap.set(
      job.job_date,
      (revenueDateMap.get(job.job_date) ?? 0) + (job.revenue_amount ?? 0)
    );
    if (job.duration_minutes) {
      durationDateMap.set(
        job.job_date,
        (durationDateMap.get(job.job_date) ?? 0) + job.duration_minutes
      );
    }
    const payLabel = PAYMENT_LABELS[job.payment_status ?? "unpaid"] ?? "Ödenmedi";
    paymentMap.set(payLabel, (paymentMap.get(payLabel) ?? 0) + 1);
    if (job.machine?.name)
      machineMap.set(job.machine.name, (machineMap.get(job.machine.name) ?? 0) + 1);
    if (job.material?.name) {
      const colorSuffix = job.material_color?.color_name
        ? ` (${job.material_color.color_name})`
        : "";
      const label = `${job.material.name}${colorSuffix}`;
      materialMap.set(label, (materialMap.get(label) ?? 0) + (job.grams_used ?? 0));
    }
  }

  for (const c of customers) {
    const src = c.source?.trim() || "Belirtilmemiş";
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
  }

  for (const f of faults) {
    const name = f.machine?.name ?? "Bilinmeyen";
    faultMachineMap.set(name, (faultMachineMap.get(name) ?? 0) + (f.duration_hours ?? 0));
  }

  return {
    totalJobs,
    completedJobs,
    pendingJobs,
    inProgressJobs,
    totalGramsUsed,
    totalRevenue,
    totalMaterialCost,
    netProfit,
    totalDurationMinutes,
    jobsByDate: Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    jobsByMachine: Array.from(machineMap.entries()).map(([name, count]) => ({
      name,
      count,
    })),
    jobsByMaterial: Array.from(materialMap.entries()).map(([name, grams]) => ({
      name,
      grams,
    })),
    jobsByStatus: [
      { status: "Bekliyor", count: pendingJobs },
      { status: "Devam Ediyor", count: inProgressJobs },
      { status: "Tamamlandı", count: completedJobs },
      {
        status: "İptal",
        count: jobs.filter((j) => j.status === "cancelled").length,
      },
    ],
    gramsByDate: Array.from(gramDateMap.entries())
      .map(([date, grams]) => ({ date, grams }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    revenueByDate: Array.from(revenueDateMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    durationByDate: Array.from(durationDateMap.entries())
      .map(([date, minutes]) => ({ date, minutes }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    jobsByPaymentStatus: Array.from(paymentMap.entries()).map(([status, count]) => ({
      status,
      count,
    })),
    customersBySource: Array.from(sourceMap.entries()).map(([source, count]) => ({
      source,
      count,
    })),
    faultDowntimeByMachine: Array.from(faultMachineMap.entries()).map(([name, hours]) => ({
      name,
      hours,
    })),
    procurementSpend: 0,
    procurementSpendByDate: [],
    catalogItemCount: 0,
    salesByChannel: [],
    lowStockCatalogItems: [],
  };
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Supplier[];
    },
  });
}

export function useMaterialPurchases() {
  return useQuery({
    queryKey: ["material_purchases"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("material_purchases")
        .select(
          "*, supplier:suppliers(*), material:materials(*), material_color:material_colors(*)"
        )
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MaterialPurchase[];
    },
  });
}

export function useCatalogItems() {
  return useQuery({
    queryKey: ["catalog_items"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("catalog_items")
        .select(
          "*, default_material:materials(*), catalog_inventory(*), catalog_files(*)"
        )
        .order("name");
      if (error) throw error;
      return (data ?? []) as CatalogItem[];
    },
  });
}

export function useCatalogItem(itemId: string | null) {
  return useQuery({
    queryKey: ["catalog_items", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("catalog_items")
        .select(
          "*, default_material:materials(*), catalog_files(*), catalog_inventory(*)"
        )
        .eq("id", itemId!)
        .single();
      if (error) throw error;
      return data as CatalogItem;
    },
  });
}

export function useCatalogSales(itemId?: string) {
  return useQuery({
    queryKey: ["sales", itemId ?? "all"],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from("sales")
        .select("*, customer:customers(*), catalog_item:catalog_items(*), shipments(*)")
        .order("sold_at", { ascending: false });
      if (itemId) query = query.eq("item_id", itemId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });
}

export function useRecentJobs(limit = 30) {
  return useQuery({
    queryKey: ["jobs", "recent", limit],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("jobs")
        .select("*, machine:machines(*), customer:customers(*)")
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as Job[];
    },
  });
}

export function useCatalogItemJobs(catalogItemId: string | null) {
  return useQuery({
    queryKey: ["catalog_item_jobs", catalogItemId],
    enabled: !!catalogItemId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("catalog_item_jobs")
        .select("*, job:jobs(*, machine:machines(*), customer:customers(*))")
        .eq("catalog_item_id", catalogItemId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CatalogItemJob[];
    },
  });
}

export function useShipmentStatusCounts() {
  return useQuery({
    queryKey: ["shipments", "status_counts"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("shipments").select("status");
      if (error) throw error;
      const counts: Record<ShipmentStatus, number> = {
        pending: 0,
        shipped: 0,
        in_transit: 0,
        delivered: 0,
        returned: 0,
      };
      for (const row of data ?? []) {
        const st = row.status as ShipmentStatus;
        if (st in counts) counts[st] += 1;
      }
      return counts;
    },
  });
}

export function useCatalogEvents(itemId: string | null) {
  return useQuery({
    queryKey: ["catalog_events", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("catalog_events")
        .select("*")
        .eq("item_id", itemId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as CatalogEvent[];
    },
  });
}

const LOW_STOCK_THRESHOLD = 3;

export function mergeBusinessMetrics(
  base: DashboardMetrics,
  purchases: MaterialPurchase[],
  catalogItems: CatalogItem[],
  sales: Sale[]
): DashboardMetrics {
  const procurementSpend = purchases.reduce((s, p) => s + Number(p.total ?? 0), 0);
  const spendByDate = new Map<string, number>();
  for (const p of purchases) {
    spendByDate.set(
      p.purchase_date,
      (spendByDate.get(p.purchase_date) ?? 0) + Number(p.total ?? 0)
    );
  }

  const channelMap = new Map<string, { count: number; revenue: number }>();
  for (const sale of sales) {
    const ch = sale.channel?.trim() || "Belirtilmemiş";
    const prev = channelMap.get(ch) ?? { count: 0, revenue: 0 };
    channelMap.set(ch, {
      count: prev.count + sale.quantity,
      revenue: prev.revenue + Number(sale.unit_price) * sale.quantity,
    });
  }

  const lowStock = catalogItems
    .filter((item) => {
      const q = item.catalog_inventory?.quantity_on_hand ?? 0;
      return q <= LOW_STOCK_THRESHOLD;
    })
    .map((item) => ({
      sku: item.sku,
      name: item.name,
      quantity: item.catalog_inventory?.quantity_on_hand ?? 0,
    }));

  return {
    ...base,
    procurementSpend,
    procurementSpendByDate: Array.from(spendByDate.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    catalogItemCount: catalogItems.length,
    salesByChannel: Array.from(channelMap.entries()).map(([channel, v]) => ({
      channel,
      count: v.count,
      revenue: v.revenue,
    })),
    lowStockCatalogItems: lowStock,
  };
}

export function getDefaultFilters(): DashboardFilters {
  const today = new Date();
  return {
    dateFrom: format(subDays(today, 30), "yyyy-MM-dd"),
    dateTo: format(today, "yyyy-MM-dd"),
    machineIds: [],
    materialIds: [],
    customerIds: [],
    statuses: [],
  };
}

export function formatDateTR(dateStr: string) {
  return format(parseISO(dateStr), "d MMM yyyy", { locale: tr });
}

export function getPlanningDates(days: number, offset = 0): string[] {
  const end = subDays(new Date(), offset * 7);
  const start = subDays(end, days - 1);
  return eachDayOfInterval({ start, end }).map((d) => format(d, "yyyy-MM-dd"));
}
