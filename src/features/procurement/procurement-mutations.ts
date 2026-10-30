import type { SupabaseClient } from "@supabase/supabase-js";
import type { Material, MaterialPurchase, Supplier } from "@/types/database";
import { getMaterialColors } from "@/lib/materials";

export type SupplierFormValues = {
  name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  notes: string;
};

export type PurchaseFormValues = {
  supplier_id: string;
  material_id: string;
  material_color_id: string;
  grams: string;
  unit_price: string;
  total: string;
  purchase_date: string;
  channel: string;
  order_url: string;
  invoice_ref: string;
  notes: string;
};

export function emptySupplierForm(): SupplierFormValues {
  return {
    name: "",
    contact_email: "",
    contact_phone: "",
    website: "",
    notes: "",
  };
}

export function supplierFormFromRecord(s: Supplier): SupplierFormValues {
  return {
    name: s.name,
    contact_email: s.contact_email ?? "",
    contact_phone: s.contact_phone ?? "",
    website: s.website ?? "",
    notes: s.notes ?? "",
  };
}

export function createPurchaseFormValues(opts: {
  suppliers: Supplier[];
  materials: Material[];
  materialId?: string;
  colorId?: string;
}): PurchaseFormValues {
  const material_id =
    opts.materialId && opts.materials.some((m) => m.id === opts.materialId)
      ? opts.materialId
      : (opts.materials[0]?.id ?? "");
  let material_color_id = "";
  if (opts.colorId && material_id) {
    const mat = opts.materials.find((m) => m.id === material_id);
    if (mat && getMaterialColors(mat).some((c) => c.id === opts.colorId)) {
      material_color_id = opts.colorId;
    }
  }
  return {
    supplier_id: opts.suppliers[0]?.id ?? "",
    material_id,
    material_color_id,
    grams: "",
    unit_price: "",
    total: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    channel: "",
    order_url: "",
    invoice_ref: "",
    notes: "",
  };
}

export function purchaseFormFromRecord(p: MaterialPurchase): PurchaseFormValues {
  return {
    supplier_id: p.supplier_id ?? "",
    material_id: p.material_id,
    material_color_id: p.material_color_id ?? "",
    grams: String(p.grams),
    unit_price: String(p.unit_price),
    total: String(p.total),
    purchase_date: p.purchase_date,
    channel: p.channel ?? "",
    order_url: p.order_url ?? "",
    invoice_ref: p.invoice_ref ?? "",
    notes: p.notes ?? "",
  };
}

export function recalcPurchaseTotal(form: PurchaseFormValues): PurchaseFormValues {
  const g = parseFloat(form.grams) || 0;
  const u = parseFloat(form.unit_price) || 0;
  if (!g || !u) return form;
  return {
    ...form,
    total: String(Math.round(((u * g) / 1000) * 100) / 100),
  };
}

export async function saveSupplierRecord(
  supabase: SupabaseClient,
  userId: string,
  editingId: string | null,
  form: SupplierFormValues
): Promise<{ error: string | null }> {
  if (!form.name.trim()) {
    return { error: "Tedarikçi adı gerekli" };
  }
  const payload = {
    user_id: userId,
    name: form.name.trim(),
    contact_email: form.contact_email.trim() || null,
    contact_phone: form.contact_phone.trim() || null,
    website: form.website.trim() || null,
    notes: form.notes.trim() || null,
  };
  const { error } = editingId
    ? await supabase.from("suppliers").update(payload).eq("id", editingId)
    : await supabase.from("suppliers").insert(payload);
  return { error: error?.message ?? null };
}

export async function savePurchaseRecord(
  supabase: SupabaseClient,
  userId: string,
  editingId: string | null,
  form: PurchaseFormValues,
  materials: Material[]
): Promise<{ error: string | null }> {
  const grams = parseInt(form.grams, 10);
  if (!form.material_id || !grams) {
    return { error: "Malzeme ve gram gerekli" };
  }
  const mat = materials.find((m) => m.id === form.material_id);
  const colors = mat ? getMaterialColors(mat) : [];
  if (colors.length > 0 && !form.material_color_id) {
    return {
      error: "Stok güncellemesi için renk seçin veya malzemeye renk ekleyin",
    };
  }
  const total =
    parseFloat(form.total) ||
    Math.round(((parseFloat(form.unit_price) || 0) * grams) / 1000 * 100) / 100;
  const payload = {
    user_id: userId,
    supplier_id: form.supplier_id || null,
    material_id: form.material_id,
    material_color_id: form.material_color_id || null,
    grams,
    unit_price: parseFloat(form.unit_price) || 0,
    total,
    purchase_date: form.purchase_date,
    channel: form.channel || null,
    order_url: form.order_url.trim() || null,
    invoice_ref: form.invoice_ref.trim() || null,
    notes: form.notes.trim() || null,
  };
  const { error } = editingId
    ? await supabase.from("material_purchases").update(payload).eq("id", editingId)
    : await supabase.from("material_purchases").insert(payload);
  return { error: error?.message ?? null };
}
