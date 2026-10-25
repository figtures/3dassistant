import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGrams(grams: number | null | undefined): string {
  if (grams == null) return "-";
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${grams} g`;
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "-";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(amount);
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null || hours <= 0) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} dk`;
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)} sa`;
}
