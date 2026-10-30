import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useTenantId } from "@/components/workspace/workspace-provider";
import type { SavedView, TableUrlSnapshot } from "@/types/database";

export type { TableUrlSnapshot };

export const SAVED_VIEWS_QUERY_KEY = ["saved-views"] as const;

const SAVED_VIEW_COLUMNS =
  "id, workspace_id, user_id, table_id, name, state, shared, created_at";

function mapSavedViewRows(data: unknown): SavedView[] {
  if (!Array.isArray(data)) return [];
  return data as SavedView[];
}

export function useSavedViews(tableId: string) {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: [...SAVED_VIEWS_QUERY_KEY, tenantId, tableId],
    queryFn: async (): Promise<SavedView[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("saved_views")
        .select(SAVED_VIEW_COLUMNS)
        .eq("workspace_id", tenantId)
        .eq("table_id", tableId)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "42P01" || error.message.includes("saved_views")) {
          return [];
        }
        throw new Error(error.message);
      }

      return mapSavedViewRows(data);
    },
  });
}

export function useSaveViewMutation(tableId: string) {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      state: TableUrlSnapshot;
      shared: boolean;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum gerekli");

      const trimmed = input.name.trim();
      if (!trimmed) throw new Error("Görünüm adı gerekli");

      const { data, error } = await supabase
        .from("saved_views")
        .insert({
          workspace_id: tenantId,
          user_id: user.id,
          table_id: tableId,
          name: trimmed,
          state: input.state,
          shared: input.shared,
        })
        .select(SAVED_VIEW_COLUMNS)
        .single();

      if (error) throw new Error(error.message);
      return data as SavedView;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...SAVED_VIEWS_QUERY_KEY, tenantId, tableId],
      });
    },
  });
}

export function useUpdateSavedViewMutation(tableId: string) {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      state?: TableUrlSnapshot;
      shared?: boolean;
    }) => {
      const supabase = createClient();
      const patch: Record<string, unknown> = {};
      if (input.name != null) patch.name = input.name.trim();
      if (input.state != null) patch.state = input.state;
      if (input.shared != null) patch.shared = input.shared;

      const { data, error } = await supabase
        .from("saved_views")
        .update(patch)
        .eq("id", input.id)
        .select(SAVED_VIEW_COLUMNS)
        .single();

      if (error) throw new Error(error.message);
      return data as SavedView;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...SAVED_VIEWS_QUERY_KEY, tenantId, tableId],
      });
    },
  });
}

export function useDeleteSavedViewMutation(tableId: string) {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("saved_views").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...SAVED_VIEWS_QUERY_KEY, tenantId, tableId],
      });
    },
  });
}
