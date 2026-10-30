"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { SAMPLE_DATA_MARKER } from "@/lib/sample-data";
import { useTenantId } from "@/components/workspace/workspace-provider";

export const SAMPLE_DATA_PRESENCE_KEY = ["sample-data", "presence"] as const;

export function useSampleDataPresence() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...SAMPLE_DATA_PRESENCE_KEY, tenantId],
    queryFn: async () => {
      const supabase = createClient();

      const { count, error } = await supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", tenantId)
        .ilike("description", `%${SAMPLE_DATA_MARKER}%`);

      if (error) throw new Error(error.message);
      return (count ?? 0) > 0;
    },
    staleTime: 30_000,
  });
}
