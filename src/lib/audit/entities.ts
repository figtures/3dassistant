/** Denetim `entity` → Türkçe kayıt türü (tekil). */
export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  jobs: "sipariş",
  machines: "makine",
  materials: "malzeme",
  material_colors: "renk stoku",
  customers: "müşteri",
  faults: "arıza",
  material_purchases: "satın alma",
  catalog_items: "katalog ürünü",
  workspace_members: "ekip üyesi",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  insert: "Oluşturma",
  update: "Güncelleme",
  delete: "Silme",
};

export const AUDIT_ENTITY_FILTER_OPTIONS = Object.entries(AUDIT_ENTITY_LABELS).map(
  ([value, label]) => ({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
);

export const AUDIT_ACTION_FILTER_OPTIONS = Object.entries(AUDIT_ACTION_LABELS).map(
  ([value, label]) => ({ value, label })
);
