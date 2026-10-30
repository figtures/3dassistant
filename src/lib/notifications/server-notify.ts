import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationKind } from "@/lib/notifications/kinds";

export type NotifyMemberInput = {
  workspaceId: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  dedupeHours?: number;
};

export async function userNotificationChannelEnabled(
  supabase: SupabaseClient,
  userId: string,
  kind: NotificationKind,
  channel: "in_app" | "email"
): Promise<boolean> {
  const { data } = await supabase
    .from("notification_preferences")
    .select("in_app, email")
    .eq("user_id", userId)
    .eq("kind", kind)
    .maybeSingle();

  const defaultEmail = kind === "payment" || kind === "team";

  if (!data) {
    return channel === "in_app" ? true : defaultEmail;
  }

  if (channel === "in_app") return data.in_app ?? true;
  return data.email ?? defaultEmail;
}

export async function insertNotificationForUser(
  supabase: SupabaseClient,
  input: NotifyMemberInput
): Promise<{ inserted: boolean }> {
  const enabled = await userNotificationChannelEnabled(
    supabase,
    input.userId,
    input.kind,
    "in_app"
  );
  if (!enabled) return { inserted: false };

  const dedupeHours = input.dedupeHours ?? 6;
  if (input.href) {
    const since = new Date(Date.now() - dedupeHours * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", input.userId)
      .eq("workspace_id", input.workspaceId)
      .eq("kind", input.kind)
      .eq("href", input.href)
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();

    if (existing) return { inserted: false };
  }

  const { error } = await supabase.from("notifications").insert({
    workspace_id: input.workspaceId,
    user_id: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
  });

  if (error) {
    if (error.code === "42P01" || error.message.includes("notifications")) {
      return { inserted: false };
    }
    throw new Error(error.message);
  }

  return { inserted: true };
}

export async function notifyWorkspaceMembersInApp(
  supabase: SupabaseClient,
  opts: {
    workspaceId: string;
    kind: NotificationKind;
    title: string;
    body?: string | null;
    href?: string | null;
    excludeUserId?: string | null;
  }
): Promise<number> {
  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", opts.workspaceId);

  if (error) {
    if (error.code === "42P01") return 0;
    throw new Error(error.message);
  }

  let count = 0;
  for (const member of members ?? []) {
    if (opts.excludeUserId && member.user_id === opts.excludeUserId) continue;
    const { inserted } = await insertNotificationForUser(supabase, {
      workspaceId: opts.workspaceId,
      userId: member.user_id,
      kind: opts.kind,
      title: opts.title,
      body: opts.body,
      href: opts.href,
    });
    if (inserted) count++;
  }
  return count;
}
