"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { SAMPLE_DATA_MARKER } from "@/lib/sample-data";

export const SAMPLE_DATA_PRESENCE_KEY = ["sample-data", "presence"] as const;

export function useSampleDataPresence() {
  return useQuery({
    queryKey: SAMPLE_DATA_PRESENCE_KEY,
    queryFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      const { count, error } = await supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .ilike("description", `%${SAMPLE_DATA_MARKER}%`);

      if (error) throw new Error(error.message);
      return (count ?? 0) > 0;
    },
    staleTime: 30_000,
  });
}
