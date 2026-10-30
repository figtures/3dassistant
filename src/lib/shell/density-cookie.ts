export const DENSITY_COOKIE = "pf_density";
export const DENSITY_COOKIE_MAX_AGE = 31536000;

export type UiDensity = "comfortable" | "compact";

export function parseUiDensity(value: string | undefined | null): UiDensity {
  return value === "compact" ? "compact" : "comfortable";
}
