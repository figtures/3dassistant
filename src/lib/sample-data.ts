import type { SupabaseClient } from "@supabase/supabase-js";
import { getEntitlements, getMachineUsage } from "@/lib/billing/entitlements";
import type { JobStatus } from "@/types/database";

/** Örnek kayıtları silmek / tespit etmek için ortak etiket */
export const SAMPLE_DATA_MARKER = "3D Assistant örnek veri";

export function tagSampleField(detail: string): string {
  return `${SAMPLE_DATA_MARKER} · ${detail}`;
}

export function isSampleTagged(value: string | null | undefined): boolean {
  return typeof value === "string" && value.includes(SAMPLE_DATA_MARKER);
}

export type SampleMachineDef = {
  name: string;
  modelDetail: string;
  status: "active" | "maintenance";
};

export type SampleMaterialDef = {
  name: string;
  brand: string;
  price_per_kg: number;
  colors: { color_name: string; hex_code: string; stock_grams: number }[];
};

export type SampleCustomerDef = {
  name: string;
  email: string;
  company: string;
  notesDetail: string;
};

export type SampleJobDef = {
  title: string;
  status: JobStatus;
  jobDayOffset: number;
  deliveryDayOffset: number;
  machineIndex: number;
  customerIndex: number;
  materialIndex: number;
  colorIndex: number;
  grams: number;
  revenue: number;
  payment_status: "unpaid" | "paid" | "partial" | "upcoming";
};

export const SAMPLE_MACHINE_DEFS: SampleMachineDef[] = [
  { name: "Demo Atölye A", modelDetail: "Creality Ender 3 V3", status: "active" },
  { name: "Demo Atölye B", modelDetail: "Prusa MK4", status: "active" },
];

export const SAMPLE_MATERIAL_DEFS: SampleMaterialDef[] = [
  {
    name: "PLA",
    brand: "Genel",
    price_per_kg: 420,
    colors: [
      { color_name: "Beyaz", hex_code: "#f4f4f5", stock_grams: 1200 },
      { color_name: "Siyah", hex_code: "#18181b", stock_grams: 800 },
    ],
  },
  {
    name: "PETG",
    brand: "Genel",
    price_per_kg: 580,
    colors: [
      { color_name: "Gri", hex_code: "#71717a", stock_grams: 900 },
      { color_name: "Şeffaf", hex_code: "#e4e4e7", stock_grams: 600 },
    ],
  },
  {
    name: "ABS",
    brand: "Genel",
    price_per_kg: 490,
    colors: [{ color_name: "Siyah", hex_code: "#27272a", stock_grams: 500 }],
  },
];

export const SAMPLE_CUSTOMER_DEFS: SampleCustomerDef[] = [
  {
    name: "Ayşe Demir",
    email: "ayse.demo@ornek.tr",
    company: "Design Co.",
    notesDetail: "Tasarım prototipleri",
  },
  {
    name: "Mehmet Kaya",
    email: "mehmet.demo@ornek.tr",
    company: "Auto3D Prototip",
    notesDetail: "Otomotiv parçaları",
  },
  {
    name: "Zeynep Arslan",
    email: "zeynep.demo@ornek.tr",
    company: "Arch Studio",
    notesDetail: "Mimari maketler",
  },
];

export const SAMPLE_JOB_DEFS: SampleJobDef[] = [
  {
    title: "Telefon Tutucu Pro",
    status: "in_progress",
    jobDayOffset: -2,
    deliveryDayOffset: 0,
    machineIndex: 0,
    customerIndex: 0,
    materialIndex: 0,
    colorIndex: 0,
    grams: 95,
    revenue: 420,
    payment_status: "partial",
  },
  {
    title: "Mimari Maket A",
    status: "pending",
    jobDayOffset: -1,
    deliveryDayOffset: 1,
    machineIndex: 1,
    customerIndex: 2,
    materialIndex: 1,
    colorIndex: 0,
    grams: 310,
    revenue: 1150,
    payment_status: "unpaid",
  },
  {
    title: "Prototip Kapak",
    status: "in_progress",
    jobDayOffset: -5,
    deliveryDayOffset: -1,
    machineIndex: 0,
    customerIndex: 1,
    materialIndex: 2,
    colorIndex: 0,
    grams: 140,
    revenue: 560,
    payment_status: "upcoming",
  },
  {
    title: "Dişli Seti",
    status: "completed",
    jobDayOffset: -10,
    deliveryDayOffset: -8,
    machineIndex: 0,
    customerIndex: 1,
    materialIndex: 0,
    colorIndex: 1,
    grams: 220,
    revenue: 890,
    payment_status: "paid",
  },
  {
    title: "Vazo Baskısı",
    status: "completed",
    jobDayOffset: -7,
    deliveryDayOffset: -5,
    machineIndex: 1,
    customerIndex: 0,
    materialIndex: 0,
    colorIndex: 0,
    grams: 180,
    revenue: 720,
    payment_status: "paid",
  },
  {
    title: "Drone Kol V3",
    status: "pending",
    jobDayOffset: 1,
    deliveryDayOffset: 4,
    machineIndex: 1,
    customerIndex: 2,
    materialIndex: 1,
    colorIndex: 1,
    grams: 175,
    revenue: 610,
    payment_status: "unpaid",
  },
  {
    title: "Sensor Muhafazası",
    status: "cancelled",
    jobDayOffset: -4,
    deliveryDayOffset: -2,
    machineIndex: 0,
    customerIndex: 2,
    materialIndex: 2,
    colorIndex: 0,
    grams: 120,
    revenue: 540,
    payment_status: "unpaid",
  },
  {
    title: "Kolye Kalıbı",
    status: "completed",
    jobDayOffset: -3,
    deliveryDayOffset: -1,
    machineIndex: 1,
    customerIndex: 0,
    materialIndex: 1,
    colorIndex: 0,
    grams: 45,
    revenue: 290,
    payment_status: "paid",
  },
];

const STATUS_COLORS: Record<JobStatus, string> = {
  completed: "#22c55e",
  in_progress: "#3b82f6",
  pending: "#f59e0b",
  cancelled: "#ef4444",
};

export function dateOffsetIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function validateSampleTemplate(): string[] {
  const errors: string[] = [];
  if (SAMPLE_MACHINE_DEFS.length !== 2) {
    errors.push("Örnek makine şablonu 2 kayıt içermeli");
  }
  if (SAMPLE_MATERIAL_DEFS.length !== 3) {
    errors.push("Örnek malzeme şablonu 3 kayıt içermeli");
  }
  if (SAMPLE_CUSTOMER_DEFS.length !== 3) {
    errors.push("Örnek müşteri şablonu 3 kayıt içermeli");
  }
  if (SAMPLE_JOB_DEFS.length !== 8) {
    errors.push("Örnek sipariş şablonu 8 kayıt içermeli");
  }
  for (const job of SAMPLE_JOB_DEFS) {
    if (job.machineIndex >= SAMPLE_MACHINE_DEFS.length) {
      errors.push(`Sipariş "${job.title}" geçersiz makine indeksi`);
    }
    if (job.customerIndex >= SAMPLE_CUSTOMER_DEFS.length) {
      errors.push(`Sipariş "${job.title}" geçersiz müşteri indeksi`);
    }
    if (job.materialIndex >= SAMPLE_MATERIAL_DEFS.length) {
      errors.push(`Sipariş "${job.title}" geçersiz malzeme indeksi`);
    }
  }
  return errors;
}

export async function userHasSampleData(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .ilike("description", `%${SAMPLE_DATA_MARKER}%`);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

function paymentFields(revenue: number, payment_status: SampleJobDef["payment_status"]) {
  if (revenue <= 0) {
    return {
      payment_status: "unpaid" as const,
      amount_paid: 0,
      amount_remaining: 0,
    };
  }
  if (payment_status === "paid") {
    return {
      payment_status: "paid" as const,
      amount_paid: revenue,
      amount_remaining: 0,
    };
  }
  if (payment_status === "partial") {
    const paid = Math.round(revenue * 0.45);
    return {
      payment_status: "partial" as const,
      amount_paid: paid,
      amount_remaining: revenue - paid,
      payment_due_date: dateOffsetIso(14),
      installment_count: 3,
      installment_amount: Math.round((revenue - paid) / 3),
    };
  }
  if (payment_status === "upcoming") {
    return {
      payment_status: "upcoming" as const,
      amount_paid: 0,
      amount_remaining: revenue,
      payment_due_date: dateOffsetIso(7),
    };
  }
  return {
    payment_status: "unpaid" as const,
    amount_paid: 0,
    amount_remaining: revenue,
  };
}

export async function insertOnboardingSampleData(
  supabase: SupabaseClient,
  userId: string
): Promise<{ created: boolean; counts: Record<string, number> }> {
  if (await userHasSampleData(supabase, userId)) {
    return { created: false, counts: {} };
  }

  const entitlements = await getEntitlements(supabase, userId);
  const usage = await getMachineUsage(supabase, userId);
  const slotsLeft = Math.max(0, entitlements.maxMachines - usage.machines);

  const machineDefsToInsert = SAMPLE_MACHINE_DEFS.slice(0, slotsLeft);
  let sortOrder = usage.machines;

  const machineIds: string[] = [];

  if (machineDefsToInsert.length > 0) {
    const rows = machineDefsToInsert.map((def, i) => ({
      user_id: userId,
      name: def.name,
      model: tagSampleField(def.modelDetail),
      status: def.status,
      sort_order: sortOrder + i,
    }));
    const { data: inserted, error } = await supabase.from("machines").insert(rows).select("id");
    if (error) throw new Error(error.message);
    machineIds.push(...(inserted?.map((m) => m.id) ?? []));
  }

  const { data: existingMachines, error: macListErr } = await supabase
    .from("machines")
    .select("id")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });
  if (macListErr) throw new Error(macListErr.message);

  const allMachineIds = existingMachines?.map((m) => m.id) ?? [];
  if (allMachineIds.length === 0) {
    throw new Error("PLAN_MACHINE_LIMIT");
  }

  const materialIds: string[] = [];
  const materialColorIds: string[][] = [];

  for (const def of SAMPLE_MATERIAL_DEFS) {
    const totalStock = def.colors.reduce((s, c) => s + c.stock_grams, 0);
    const { data: mat, error: matErr } = await supabase
      .from("materials")
      .insert({
        user_id: userId,
        name: def.name,
        brand: tagSampleField(def.brand),
        color: null,
        price_per_kg: def.price_per_kg,
        stock_grams: totalStock,
      })
      .select("id")
      .single();
    if (matErr) throw new Error(matErr.message);
    materialIds.push(mat.id);

    const colorRows = def.colors.map((c, i) => ({
      material_id: mat.id,
      user_id: userId,
      color_name: c.color_name,
      hex_code: c.hex_code,
      stock_grams: c.stock_grams,
      sort_order: i,
    }));
    const { data: colors, error: colorErr } = await supabase
      .from("material_colors")
      .insert(colorRows)
      .select("id");
    if (colorErr) throw new Error(colorErr.message);
    materialColorIds.push(colors?.map((c) => c.id) ?? []);
  }

  const { data: customers, error: custErr } = await supabase
    .from("customers")
    .insert(
      SAMPLE_CUSTOMER_DEFS.map((c) => ({
        user_id: userId,
        name: c.name,
        email: c.email,
        phone: null,
        company: c.company,
        notes: tagSampleField(c.notesDetail),
        source: "Diğer",
        referral: null,
      }))
    )
    .select("id");
  if (custErr) throw new Error(custErr.message);
  const customerIds = customers?.map((c) => c.id) ?? [];

  const usedSlots = new Set<string>();
  const jobRows: Record<string, unknown>[] = [];

  for (const def of SAMPLE_JOB_DEFS) {
    const machineId = allMachineIds[def.machineIndex % allMachineIds.length];
    const jobDate = dateOffsetIso(def.jobDayOffset);
    const slotKey = `${machineId}_${jobDate}`;
    if (usedSlots.has(slotKey)) continue;
    usedSlots.add(slotKey);

    const matId = materialIds[def.materialIndex];
    const colorId =
      materialColorIds[def.materialIndex]?.[def.colorIndex] ??
      materialColorIds[def.materialIndex]?.[0] ??
      null;

    jobRows.push({
      user_id: userId,
      machine_id: machineId,
      customer_id: customerIds[def.customerIndex],
      material_id: matId,
      material_color_id: colorId,
      job_date: jobDate,
      delivery_date: dateOffsetIso(def.deliveryDayOffset),
      title: def.title,
      description: tagSampleField("Onboarding demo siparişi"),
      grams_used: def.grams,
      revenue_amount: def.revenue,
      status: def.status,
      cell_color: STATUS_COLORS[def.status],
      duration_minutes:
        def.status === "completed" ? 90 : def.status === "in_progress" ? 45 : null,
      ...paymentFields(def.revenue, def.payment_status),
    });
  }

  const { data: jobs, error: jobErr } = await supabase.from("jobs").insert(jobRows).select("id");
  if (jobErr) throw new Error(jobErr.message);

  return {
    created: true,
    counts: {
      machines: machineIds.length,
      materials: materialIds.length,
      customers: customerIds.length,
      jobs: jobs?.length ?? 0,
    },
  };
}

export async function deleteOnboardingSampleData(
  supabase: SupabaseClient,
  userId: string
): Promise<{ deleted: Record<string, number> }> {
  const markerFilter = `%${SAMPLE_DATA_MARKER}%`;

  const { data: sampleJobs, error: jobsErr } = await supabase
    .from("jobs")
    .select("id")
    .eq("user_id", userId)
    .ilike("description", markerFilter);
  if (jobsErr) throw new Error(jobsErr.message);
  const jobIds = sampleJobs?.map((j) => j.id) ?? [];

  if (jobIds.length > 0) {
    await supabase.from("job_notes").delete().in("job_id", jobIds);
    await supabase.from("job_files").delete().in("job_id", jobIds);
    const { error: delJobsErr } = await supabase.from("jobs").delete().in("id", jobIds);
    if (delJobsErr) throw new Error(delJobsErr.message);
  }

  const { data: sampleMaterials, error: matErr } = await supabase
    .from("materials")
    .select("id")
    .eq("user_id", userId)
    .ilike("brand", markerFilter);
  if (matErr) throw new Error(matErr.message);
  const materialIds = sampleMaterials?.map((m) => m.id) ?? [];
  if (materialIds.length > 0) {
    await supabase.from("material_colors").delete().in("material_id", materialIds);
    const { error: delMatErr } = await supabase.from("materials").delete().in("id", materialIds);
    if (delMatErr) throw new Error(delMatErr.message);
  }

  const { data: sampleMachines, error: macErr } = await supabase
    .from("machines")
    .select("id")
    .eq("user_id", userId)
    .ilike("model", markerFilter);
  if (macErr) throw new Error(macErr.message);
  const machineIds = sampleMachines?.map((m) => m.id) ?? [];
  if (machineIds.length > 0) {
    const { error: delMacErr } = await supabase.from("machines").delete().in("id", machineIds);
    if (delMacErr) throw new Error(delMacErr.message);
  }

  const { data: sampleCustomers, error: custErr } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", userId)
    .ilike("notes", markerFilter);
  if (custErr) throw new Error(custErr.message);
  const customerIds = sampleCustomers?.map((c) => c.id) ?? [];

  let customersDeleted = 0;
  for (const customerId of customerIds) {
    const { count, error: refErr } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("customer_id", customerId);
    if (refErr) throw new Error(refErr.message);
    if ((count ?? 0) > 0) continue;
    const { error: delCustErr } = await supabase
      .from("customers")
      .delete()
      .eq("id", customerId)
      .eq("user_id", userId);
    if (delCustErr) throw new Error(delCustErr.message);
    customersDeleted += 1;
  }

  return {
    deleted: {
      jobs: jobIds.length,
      materials: materialIds.length,
      machines: machineIds.length,
      customers: customersDeleted,
    },
  };
}
