import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useTenantId } from "@/components/workspace/workspace-provider";
import type { Notification, NotificationPreference } from "@/types/database";
import {
  defaultNotificationPreferences,
  mergeNotificationPreferences,
  type NotificationPreferenceRow,
} from "@/lib/notifications/kinds";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;
export const NOTIFICATION_PREFS_QUERY_KEY = ["notifications", "preferences"] as const;

const POLL_MS = 60_000;

function mapNotificationRows(data: unknown): Notification[] {
  if (!Array.isArray(data)) return [];
  return data as Notification[];
}

export function useNotifications(kindFilter?: string | null) {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, tenantId, kindFilter ?? "all"],
    queryFn: async (): Promise<Notification[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from("notifications")
        .select(
          "id, workspace_id, user_id, kind, title, body, href, seen_at, done_at, created_at"
        )
        .eq("workspace_id", tenantId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (kindFilter) {
        query = query.eq("kind", kindFilter);
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === "42P01" || error.message.includes("notifications")) {
          return [];
        }
        throw new Error(error.message);
      }

      return mapNotificationRows(data);
    },
    refetchInterval: POLL_MS,
  });
}

export function useUnreadNotificationCount() {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, tenantId, "unread-count"],
    queryFn: async (): Promise<number> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", tenantId)
        .eq("user_id", user.id)
        .is("seen_at", null);

      if (error) {
        if (error.code === "42P01" || error.message.includes("notifications")) {
          return 0;
        }
        throw new Error(error.message);
      }

      return count ?? 0;
    },
    refetchInterval: POLL_MS,
  });
}

export function useNotificationMutations() {
  const tenantId = useTenantId();
  const qc = useQueryClient();

  async function invalidate() {
    await qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
  }

  const markSeen = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("notifications")
        .update({ seen_at: now })
        .eq("id", id)
        .eq("workspace_id", tenantId);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("notifications")
        .update({ seen_at: now, done_at: now })
        .eq("id", id)
        .eq("workspace_id", tenantId);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const markAllSeen = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("notifications")
        .update({ seen_at: now })
        .eq("workspace_id", tenantId)
        .eq("user_id", user.id)
        .is("seen_at", null);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return { markSeen, markDone, markAllSeen };
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: NOTIFICATION_PREFS_QUERY_KEY,
    queryFn: async (): Promise<NotificationPreferenceRow[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return defaultNotificationPreferences();

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("kind, in_app, email")
        .eq("user_id", user.id);

      if (error) {
        if (
          error.code === "42P01" ||
          error.message.includes("notification_preferences")
        ) {
          return defaultNotificationPreferences();
        }
        throw new Error(error.message);
      }

      return mergeNotificationPreferences((data ?? []) as NotificationPreference[]);
    },
  });
}

export function useSaveNotificationPreferences() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (rows: NotificationPreferenceRow[]) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum gerekli");

      const payload = rows.map((row) => ({
        user_id: user.id,
        kind: row.kind,
        in_app: row.in_app,
        email: row.email,
      }));

      const { error } = await supabase
        .from("notification_preferences")
        .upsert(payload, { onConflict: "user_id,kind" });

      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: NOTIFICATION_PREFS_QUERY_KEY });
    },
  });
}
