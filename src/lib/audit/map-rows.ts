import type { AuditEvent } from "@/types/database";

/** Supabase join satırını AuditEvent tipine çevirir. */
export function mapAuditEventRows(data: unknown): AuditEvent[] {
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const r = row as Record<string, unknown>;
    const actor = r.actor;
    const normalizedActor = Array.isArray(actor) ? actor[0] ?? null : actor;
    return { ...r, actor: normalizedActor } as AuditEvent;
  });
}
