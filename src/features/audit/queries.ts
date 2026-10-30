import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useTenantId } from "@/components/workspace/workspace-provider";
import type { AuditEvent } from "@/types/database";
import { mapAuditEventRows } from "@/lib/audit/map-rows";

export const AUDIT_EVENTS_QUERY_KEY = ["audit", "events"] as const;

export type AuditEventsParams = {
  entity?: string;
  action?: string;
  q?: string;
  limit?: number;
};

export function useAuditEvents(params: AuditEventsParams = {}) {
  const tenantId = useTenantId();
  const limit = params.limit ?? 200;

  return useQuery({
    queryKey: [...AUDIT_EVENTS_QUERY_KEY, tenantId, params],
    queryFn: async (): Promise<AuditEvent[]> => {
      const supabase = createClient();
      let query = supabase
        .from("audit_events")
        .select(
          "id, workspace_id, actor_id, action, entity, entity_id, diff, created_at, actor:profiles(full_name, email)"
        )
        .eq("workspace_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (params.entity) {
        query = query.eq("entity", params.entity);
      }
      if (params.action) {
        query = query.eq("action", params.action);
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === "42P01" || error.message.includes("audit_events")) {
          return [];
        }
        throw new Error(error.message);
      }

      return mapAuditEventRows(data);
    },
  });
}
