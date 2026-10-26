const TEXT_ON_LIGHT = "#1a0d05";
const TEXT_ON_DARK = "#ededef";

function normalizeHex(hex: string): string {
  const raw = hex.trim().replace(/^#/, "");
  if (raw.length === 3) {
    return raw
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return raw.slice(0, 6);
}

function channel(value: string): number {
  const n = parseInt(value, 16) / 255;
  return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}

/** WCAG göreli parlaklık (0–1). */
export function relativeLuminance(hex: string): number {
  const h = normalizeHex(hex);
  const r = channel(h.slice(0, 2));
  const g = channel(h.slice(2, 4));
  const b = channel(h.slice(4, 6));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Hücre arka plan rengine göre okunabilir metin rengi. */
export function readableTextColor(backgroundHex: string): string {
  const lum = relativeLuminance(backgroundHex);
  return lum > 0.55 ? TEXT_ON_LIGHT : TEXT_ON_DARK;
}

/** Plan hücresi arka planı (hafif dolgu). */
export function cellFillColor(hex: string, mixPercent = 18): string {
  const h = normalizeHex(hex);
  return `color-mix(in oklab, #${h} ${mixPercent}%, transparent)`;
}

export function cellBorderColor(hex: string, mixPercent = 38): string {
  const h = normalizeHex(hex);
  return `color-mix(in oklab, #${h} ${mixPercent}%, transparent)`;
}
