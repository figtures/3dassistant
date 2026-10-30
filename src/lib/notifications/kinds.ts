export const NOTIFICATION_KINDS = [
  "machine",
  "order",
  "stock",
  "payment",
  "team",
  "system",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  machine: "Makine",
  order: "Sipariş",
  stock: "Stok",
  payment: "Ödeme",
  team: "Ekip",
  system: "Sistem",
};

export type NotificationPreferenceRow = {
  kind: NotificationKind;
  in_app: boolean;
  email: boolean;
};

export function defaultNotificationPreferences(): NotificationPreferenceRow[] {
  return NOTIFICATION_KINDS.map((kind) => ({
    kind,
    in_app: true,
    email: kind === "payment" || kind === "team",
  }));
}

export function mergeNotificationPreferences(
  rows: NotificationPreferenceRow[]
): NotificationPreferenceRow[] {
  const byKind = new Map(rows.map((r) => [r.kind, r]));
  return defaultNotificationPreferences().map((def) => {
    const saved = byKind.get(def.kind);
    return saved ?? def;
  });
}
