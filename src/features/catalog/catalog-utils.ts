import type { CatalogFile, CatalogFileType, ShipmentStatus } from "@/types/database";

export function inventoryQty(item: { catalog_inventory?: unknown }): number {
  const inv = item.catalog_inventory;
  if (Array.isArray(inv)) return inv[0]?.quantity_on_hand ?? 0;
  if (inv && typeof inv === "object" && "quantity_on_hand" in inv) {
    return (inv as { quantity_on_hand: number }).quantity_on_hand;
  }
  return 0;
}

export function inventoryRecord(item: { catalog_inventory?: unknown }) {
  const inv = item.catalog_inventory;
  if (Array.isArray(inv)) return inv[0];
  return inv as { quantity_on_hand: number; quantity_reserved: number } | undefined;
}

export function hasStl(item: { catalog_files?: { file_type: string }[] }) {
  return item.catalog_files?.some((f) => f.file_type === "stl") ?? false;
}

export function detectFileType(name: string): CatalogFileType {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "stl") return "stl";
  if (ext === "3mf") return "3mf";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext ?? "")) return "image";
  if (ext === "zip") return "zip";
  return "other";
}

export const SALE_CHANNELS = ["Instagram", "Trendyol", "Web sitesi", "Mağaza", "Diğer"];

export const SHIPMENT_STATUSES: { value: ShipmentStatus; label: string }[] = [
  { value: "pending", label: "Bekliyor" },
  { value: "shipped", label: "Kargolandı" },
  { value: "in_transit", label: "Yolda" },
  { value: "delivered", label: "Teslim" },
  { value: "returned", label: "İade" },
];

export function fileTypeLabel(t: string): string {
  const labels: Record<string, string> = {
    stl: "STL",
    "3mf": "3MF",
    image: "Görsel",
    zip: "ZIP",
    other: "Diğer",
  };
  return labels[t] ?? t;
}

export type CatalogTab = "general" | "files" | "stock" | "sales" | "production";

export const CATALOG_TABS: { id: CatalogTab; label: string }[] = [
  { id: "general", label: "Genel" },
  { id: "files", label: "Dosyalar" },
  { id: "stock", label: "Stok" },
  { id: "sales", label: "Satışlar" },
  { id: "production", label: "Üretim geçmişi" },
];
