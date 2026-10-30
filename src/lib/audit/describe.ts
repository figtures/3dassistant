import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/features/orders/order-constants";
import { WORKSPACE_ROLE_LABELS } from "@/lib/workspace/role-labels";
import { readDiffField, readDiffFieldChange, diffFieldNames } from "@/lib/audit/diff";
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from "@/lib/audit/entities";
import { formatCurrency } from "@/lib/format";
import type { AuditEvent, JobStatus, PaymentStatus, WorkspaceRole } from "@/types/database";

export type AuditDescribeContext = {
  actorName?: string | null;
  /** entity_id → görünen ad (ör. sipariş başlığı) */
  entityLabels?: Record<string, string>;
};

const FIELD_LABELS: Record<string, string> = {
  title: "başlık",
  name: "ad",
  status: "durum",
  payment_status: "ödeme durumu",
  amount_paid: "ödenen tutar",
  revenue_amount: "ciro",
  role: "rol",
  stock_grams: "stok (g)",
  grams_used: "kullanılan gram",
  delivery_date: "teslim tarihi",
  machine_id: "makine",
  customer_id: "müşteri",
  email: "e-posta",
  company: "firma",
  color_name: "renk adı",
  price_per_kg: "kg fiyatı",
};

function actorLabel(ctx: AuditDescribeContext): string {
  const name = ctx.actorName?.trim();
  return name || "Bir kullanıcı";
}

function entityDisplayName(event: AuditEvent, ctx: AuditDescribeContext): string {
  const fromCtx =
    event.entity_id && ctx.entityLabels?.[event.entity_id]
      ? ctx.entityLabels[event.entity_id]
      : null;
  if (fromCtx) return fromCtx;

  const fromDiff =
    readDiffField(event.diff, "title") ??
    readDiffField(event.diff, "name") ??
    readDiffField(event.diff, "color_name") ??
    readDiffField(event.diff, "email");
  if (typeof fromDiff === "string" && fromDiff.trim()) return fromDiff.trim();

  const kind = AUDIT_ENTITY_LABELS[event.entity] ?? event.entity;
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "status" && typeof value === "string") {
    return ORDER_STATUS_LABELS[value as JobStatus] ?? value;
  }
  if (field === "payment_status" && typeof value === "string") {
    return PAYMENT_STATUS_LABELS[value as PaymentStatus] ?? value;
  }
  if (field === "role" && typeof value === "string") {
    return WORKSPACE_ROLE_LABELS[value as WorkspaceRole] ?? value;
  }
  if (
    (field === "amount_paid" ||
      field === "revenue_amount" ||
      field === "price_per_kg") &&
    typeof value === "number"
  ) {
    return formatCurrency(value);
  }
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  return String(value);
}

/** Tam Türkçe cümle — tablo ve CSV açıklama sütunu. */
export function describeAuditEvent(
  event: AuditEvent,
  ctx: AuditDescribeContext = {}
): string {
  const actor = actorLabel(ctx);
  const name = entityDisplayName(event, ctx);
  const kind = AUDIT_ENTITY_LABELS[event.entity] ?? "kayıt";

  if (event.entity === "jobs" && event.action === "update") {
    const statusChange = readDiffFieldChange(event.diff, "status");
    if (statusChange) {
      const label = formatFieldValue("status", statusChange.new);
      return `${actor}, '${name}' siparişinin durumunu ${label} olarak değiştirdi`;
    }
    const paymentChange = readDiffFieldChange(event.diff, "payment_status");
    if (paymentChange) {
      const label = formatFieldValue("payment_status", paymentChange.new);
      return `${actor}, '${name}' siparişinin ödeme durumunu ${label} yaptı`;
    }
  }

  if (event.entity === "workspace_members" && event.action === "update") {
    const roleChange = readDiffFieldChange(event.diff, "role");
    if (roleChange) {
      const label = formatFieldValue("role", roleChange.new);
      return `${actor}, ekip üyesinin rolünü ${label} olarak güncelledi`;
    }
  }

  if (event.action === "insert") {
    if (event.entity === "jobs") {
      return `${actor}, '${name}' siparişini oluşturdu`;
    }
    return `${actor}, yeni ${kind} ekledi (${name})`;
  }

  if (event.action === "delete") {
    return `${actor}, '${name}' ${kind} kaydını sildi`;
  }

  const fields = diffFieldNames(event.diff);
  if (fields.length === 1) {
    const field = fields[0]!;
    const change = readDiffFieldChange(event.diff, field);
    const fieldLabel = FIELD_LABELS[field] ?? field;
    if (change) {
      const newVal = formatFieldValue(field, change.new);
      return `${actor}, '${name}' ${kind} kaydında ${fieldLabel} alanını ${newVal} yaptı`;
    }
  }

  if (fields.length > 1) {
    return `${actor}, '${name}' ${kind} kaydında ${fields.length} alanı güncelledi`;
  }

  return `${actor}, ${kind} üzerinde ${AUDIT_ACTION_LABELS[event.action]?.toLowerCase() ?? event.action} yaptı`;
}

/** Tablo "değişiklik" sütunu — kısa özet. */
export function summarizeAuditDiff(event: AuditEvent): string {
  if (event.action === "insert") return "Yeni kayıt";
  if (event.action === "delete") return "Kayıt silindi";

  const fields = diffFieldNames(event.diff);
  if (!fields.length) return "—";

  const parts = fields.slice(0, 3).map((field) => {
    const change = readDiffFieldChange(event.diff, field);
    const label = FIELD_LABELS[field] ?? field;
    if (!change) return label;
    return `${label}: ${formatFieldValue(field, change.old)} → ${formatFieldValue(field, change.new)}`;
  });

  const extra = fields.length > 3 ? ` (+${fields.length - 3})` : "";
  return parts.join("; ") + extra;
}

export function formatActorName(
  profile: { full_name?: string | null; email?: string | null } | null | undefined
): string {
  if (!profile) return "Sistem";
  return profile.full_name?.trim() || profile.email?.trim() || "Kullanıcı";
}
