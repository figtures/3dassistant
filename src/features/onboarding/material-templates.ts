export type MaterialTemplateColor = {
  color_name: string;
  hex_code: string;
};

export type MaterialTemplate = {
  id: string;
  name: string;
  brand: string;
  colors: MaterialTemplateColor[];
};

export const ONBOARDING_MATERIAL_TEMPLATES: MaterialTemplate[] = [
  {
    id: "pla",
    name: "PLA",
    brand: "Genel",
    colors: [
      { color_name: "Beyaz", hex_code: "#f4f4f5" },
      { color_name: "Siyah", hex_code: "#18181b" },
    ],
  },
  {
    id: "petg",
    name: "PETG",
    brand: "Genel",
    colors: [
      { color_name: "Gri", hex_code: "#71717a" },
      { color_name: "Şeffaf", hex_code: "#e4e4e7" },
    ],
  },
  {
    id: "abs",
    name: "ABS",
    brand: "Genel",
    colors: [{ color_name: "Siyah", hex_code: "#27272a" }],
  },
  {
    id: "tpu",
    name: "TPU",
    brand: "Genel",
    colors: [{ color_name: "Kırmızı", hex_code: "#dc2626" }],
  },
  {
    id: "asa",
    name: "ASA",
    brand: "Genel",
    colors: [{ color_name: "Antrasit", hex_code: "#3f3f46" }],
  },
];
