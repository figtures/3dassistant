import type { Material, MaterialColor } from "@/types/database";

export function getMaterialColors(material: Material): MaterialColor[] {
  return material.material_colors ?? [];
}

export function getMaterialTotalStock(material: Material): number {
  const colors = getMaterialColors(material);
  if (colors.length) {
    return colors.reduce((sum, c) => sum + (c.stock_grams ?? 0), 0);
  }
  return material.stock_grams ?? 0;
}

export function formatMaterialOption(
  material: Material,
  color?: MaterialColor | null
): string {
  const base = material.brand
    ? `${material.name} · ${material.brand}`
    : material.name;
  if (color?.color_name) {
    return `${base} — ${color.color_name}`;
  }
  return base;
}

export function findColorForMaterial(
  material: Material,
  colorName?: string
): MaterialColor | undefined {
  if (!colorName) return undefined;
  const norm = colorName.toLowerCase();
  return getMaterialColors(material).find(
    (c) => c.color_name.toLowerCase() === norm
  );
}
