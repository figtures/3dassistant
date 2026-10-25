export const SIDEBAR_COOKIE = "pf_sidebar";

export function parseSidebarCollapsed(value: string | undefined | null): boolean {
  return value === "1" || value === "true";
}

export const SIDEBAR_COOKIE_MAX_AGE = 31536000;
