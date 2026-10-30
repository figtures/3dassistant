import type { SupabaseClient } from "@supabase/supabase-js";
import type { Fault, FaultStatus, FaultType } from "@/types/database";
import { DEFAULT_FAULT_TYPES } from "@/features/faults/fault-constants";

export type FaultFormValues = {
  machine_id: string;
  fault_type_id: string;
  fault_type_name: string;
  duration_hours: string;
  description: string;
  fault_date: string;
  status: FaultStatus;
};

export function emptyFaultForm(machineId?: string): FaultFormValues {
  return {
    machine_id: machineId ?? "",
    fault_type_id: "",
    fault_type_name: "",
    duration_hours: "",
    description: "",
    fault_date: new Date().toISOString().slice(0, 10),
    status: "open",
  };
}

export function faultFormFromRecord(fault: Fault): FaultFormValues {
  return {
    machine_id: fault.machine_id,
    fault_type_id: fault.fault_type_id ?? "",
    fault_type_name: fault.fault_type_name ?? fault.fault_type?.name ?? "",
    duration_hours: String(fault.duration_hours ?? ""),
    description: fault.description ?? "",
    fault_date: fault.fault_date,
    status: fault.status,
  };
}

export function resolveTypeOptions(faultTypes: FaultType[]): FaultType[] {
  if (faultTypes.length) return faultTypes;
  return DEFAULT_FAULT_TYPES.map((name, i) => ({
    id: name,
    name,
    sort_order: i,
    user_id: "",
    created_at: "",
    updated_at: "",
  }));
}

async function ensureFaultType(
  supabase: SupabaseClient,
  userId: string,
  faultTypes: FaultType[],
  name: string
): Promise<string | null> {
  if (!name.trim()) return null;
  const existing = faultTypes.find((t) => t.name.toLowerCase() === name.trim().toLowerCase());
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("fault_types")
    .insert({ user_id: userId, name: name.trim(), sort_order: faultTypes.length })
    .select("id")
    .single();
  if (error) return null;
  return data?.id ?? null;
}

export async function saveFaultRecord(
  supabase: SupabaseClient,
  userId: string,
  editingId: string | null,
  form: FaultFormValues,
  faultTypes: FaultType[],
  typeOptions: FaultType[]
): Promise<{ error: string | null }> {
  if (!form.machine_id) {
    return { error: "Makine seçin" };
  }
  const typeName =
    form.fault_type_name || typeOptions.find((t) => t.id === form.fault_type_id)?.name || "";
  let faultTypeId = form.fault_type_id || null;
  if (!faultTypeId && typeName) {
    faultTypeId = await ensureFaultType(supabase, userId, faultTypes, typeName);
  }
  const payload = {
    user_id: userId,
    machine_id: form.machine_id,
    fault_type_id: faultTypeId,
    fault_type_name: typeName || null,
    duration_hours: form.duration_hours ? parseFloat(form.duration_hours) : 0,
    description: form.description || null,
    fault_date: form.fault_date,
    status: form.status,
  };
  const { error } = editingId
    ? await supabase.from("faults").update(payload).eq("id", editingId)
    : await supabase.from("faults").insert(payload);
  return { error: error?.message ?? null };
}

export async function setMachineMaintenance(
  supabase: SupabaseClient,
  machineId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("machines")
    .update({ status: "maintenance" })
    .eq("id", machineId);
  return { error: error?.message ?? null };
}
