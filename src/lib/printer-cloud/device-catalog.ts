import type { PrinterVendor } from "./types";

export type CatalogDevice = {
  vendor: PrinterVendor;
  /** Kısa kod (X1C, K1 Max) */
  code: string;
  name: string;
  family: string;
  aliases: string[];
};

/**
 * Bulut API model adını tanır; tanımazsa ham metni korur.
 * Liste filtrelemez — bilinmeyen modeller de bağlanır.
 */
export const DEVICE_CATALOG: CatalogDevice[] = [
  // Bambu Lab — mevcut ve duyurulmuş FDM serisi
  { vendor: "bambu", code: "X1C", name: "X1 Carbon", family: "X1", aliases: ["x1 carbon", "x1c", "bl-p001", "x1-carbon"] },
  { vendor: "bambu", code: "X1E", name: "X1E", family: "X1", aliases: ["x1e", "x1-e"] },
  { vendor: "bambu", code: "X1", name: "X1", family: "X1", aliases: ["x1"] },
  { vendor: "bambu", code: "P1S", name: "P1S", family: "P1", aliases: ["p1s", "c12"] },
  { vendor: "bambu", code: "P1P", name: "P1P", family: "P1", aliases: ["p1p", "c11"] },
  { vendor: "bambu", code: "P2S", name: "P2S", family: "P2", aliases: ["p2s"] },
  { vendor: "bambu", code: "A1", name: "A1", family: "A1", aliases: ["a1", "n2s"] },
  { vendor: "bambu", code: "A1 mini", name: "A1 mini", family: "A1", aliases: ["a1 mini", "a1mini", "a1-mini", "n1"] },
  { vendor: "bambu", code: "H2D", name: "H2D", family: "H2", aliases: ["h2d"] },
  { vendor: "bambu", code: "H2S", name: "H2S", family: "H2", aliases: ["h2s"] },
  { vendor: "bambu", code: "X2D", name: "X2D", family: "X2", aliases: ["x2d", "n6"] },

  // Creality FDM — Cloud'a bağlanabilen yaygın atölye modelleri
  { vendor: "creality", code: "K1", name: "K1", family: "K1", aliases: ["k1"] },
  { vendor: "creality", code: "K1C", name: "K1C", family: "K1", aliases: ["k1c", "k1-c"] },
  { vendor: "creality", code: "K1 Max", name: "K1 Max", family: "K1", aliases: ["k1 max", "k1max", "k1-max"] },
  { vendor: "creality", code: "K1 SE", name: "K1 SE", family: "K1", aliases: ["k1 se", "k1se"] },
  { vendor: "creality", code: "K1C SE", name: "K1C SE", family: "K1", aliases: ["k1c se", "k1cse"] },
  { vendor: "creality", code: "K2", name: "K2", family: "K2", aliases: ["k2"] },
  { vendor: "creality", code: "K2 Plus", name: "K2 Plus", family: "K2", aliases: ["k2 plus", "k2plus", "k2-plus"] },
  { vendor: "creality", code: "Ender-3 V3", name: "Ender-3 V3", family: "Ender-3", aliases: ["ender-3 v3", "ender3 v3", "ender 3 v3"] },
  { vendor: "creality", code: "Ender-3 V3 KE", name: "Ender-3 V3 KE", family: "Ender-3", aliases: ["ender-3 v3 ke", "ender3 v3 ke", "v3 ke"] },
  { vendor: "creality", code: "Ender-3 V3 SE", name: "Ender-3 V3 SE", family: "Ender-3", aliases: ["ender-3 v3 se", "ender3 v3 se", "v3 se"] },
  { vendor: "creality", code: "Ender-3 V3 Plus", name: "Ender-3 V3 Plus", family: "Ender-3", aliases: ["ender-3 v3 plus", "v3 plus"] },
  { vendor: "creality", code: "Ender-3 S1", name: "Ender-3 S1", family: "Ender-3", aliases: ["ender-3 s1", "ender3 s1"] },
  { vendor: "creality", code: "Ender-3 S1 Pro", name: "Ender-3 S1 Pro", family: "Ender-3", aliases: ["ender-3 s1 pro", "s1 pro"] },
  { vendor: "creality", code: "Ender-3 V2", name: "Ender-3 V2", family: "Ender-3", aliases: ["ender-3 v2", "ender3 v2"] },
  { vendor: "creality", code: "Ender-3 V2 Neo", name: "Ender-3 V2 Neo", family: "Ender-3", aliases: ["ender-3 v2 neo"] },
  { vendor: "creality", code: "Ender-5 S1", name: "Ender-5 S1", family: "Ender-5", aliases: ["ender-5 s1", "ender5 s1"] },
  { vendor: "creality", code: "Ender-5 Max", name: "Ender-5 Max", family: "Ender-5", aliases: ["ender-5 max", "ender5 max"] },
  { vendor: "creality", code: "CR-10 SE", name: "CR-10 SE", family: "CR-10", aliases: ["cr-10 se", "cr10 se"] },
  { vendor: "creality", code: "CR-10 Smart Pro", name: "CR-10 Smart Pro", family: "CR-10", aliases: ["cr-10 smart pro"] },
  { vendor: "creality", code: "CR-M4", name: "CR-M4", family: "CR", aliases: ["cr-m4", "crm4"] },
  { vendor: "creality", code: "Sermoon D3", name: "Sermoon D3", family: "Sermoon", aliases: ["sermoon d3"] },
  { vendor: "creality", code: "Sermoon D3 Pro", name: "Sermoon D3 Pro", family: "Sermoon", aliases: ["sermoon d3 pro"] },
  { vendor: "creality", code: "Hi", name: "Hi", family: "Hi", aliases: ["creality hi", "hi combo"] },
  { vendor: "creality", code: "Hi Combo", name: "Hi Combo", family: "Hi", aliases: ["hi combo"] },
];

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function findCatalogDevice(
  vendor: PrinterVendor,
  raw: string | null | undefined
): CatalogDevice | null {
  const key = raw?.trim();
  if (!key) return null;
  const compact = normalizeKey(key);
  const list = DEVICE_CATALOG.filter((d) => d.vendor === vendor);
  return (
    list.find((d) => normalizeKey(d.code) === compact || normalizeKey(d.name) === compact) ??
    list.find((d) => d.aliases.some((a) => normalizeKey(a) === compact)) ??
    list.find((d) => compact.includes(normalizeKey(d.code)) || compact.includes(normalizeKey(d.name))) ??
    null
  );
}

/** Tanınan modellerde katalog adı, diğerlerinde ham metin. Asla elemez. */
export function resolveVendorModel(
  vendor: PrinterVendor,
  raw: string | null | undefined
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return findCatalogDevice(vendor, trimmed)?.name ?? trimmed;
}

export function catalogForVendor(vendor: PrinterVendor): CatalogDevice[] {
  return DEVICE_CATALOG.filter((d) => d.vendor === vendor);
}
