export const WORKSPACE_BILLING_META_KEY = "workspace_billing";

export type WorkspaceBillingMeta = {
  taxNumber?: string;
  billingAddress?: string;
  timezone?: string;
};

export function readWorkspaceBillingMeta(
  metadata: Record<string, unknown> | undefined
): WorkspaceBillingMeta {
  const raw = metadata?.[WORKSPACE_BILLING_META_KEY];
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  return {
    taxNumber:
      typeof obj.taxNumber === "string" ? obj.taxNumber : undefined,
    billingAddress:
      typeof obj.billingAddress === "string" ? obj.billingAddress : undefined,
    timezone: typeof obj.timezone === "string" ? obj.timezone : undefined,
  };
}

export function mergeWorkspaceBillingMeta(
  metadata: Record<string, unknown> | undefined,
  patch: WorkspaceBillingMeta
): Record<string, unknown> {
  const base = { ...(metadata ?? {}) };
  const prev = readWorkspaceBillingMeta(base);
  base[WORKSPACE_BILLING_META_KEY] = {
    ...prev,
    ...patch,
  };
  return base;
}

export const WORKSPACE_TIMEZONES = [
  { value: "Europe/Istanbul", label: "Türkiye (İstanbul)" },
  { value: "Europe/Berlin", label: "Almanya (Berlin)" },
  { value: "UTC", label: "UTC" },
] as const;
