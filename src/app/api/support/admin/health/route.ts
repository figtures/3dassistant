import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient, SERVICE_ROLE_MISSING_MESSAGE } from "@/lib/supabase/admin";
import { isSupportAdminEmail } from "@/lib/support/admin";
import { PLANS, type PlanKey } from "@/lib/billing/plans";
import { computeHealthScore, type TenantHealthRow } from "@/lib/support/health-score";

export const dynamic = "force-dynamic";

type WorkspaceRow = { id: string; name: string; ui_version: "v1" | "v2" | null };
type MemberRow = { workspace_id: string; user_id: string };
type ProfileRow = { id: string; email: string | null };
type SubscriptionRow = {
  user_id: string;
  plan_key: string;
  status: string;
};
type MachineRow = { user_id: string; connection_status: string };
type JobRow = { user_id: string; created_at: string };
type SupportRow = { user_id: string; status: string };
type ErrorRow = { user_id: string | null; count: number; last_seen: string };
type NpsRow = { workspace_id: string | null; score: number; created_at: string };

function isPlanKey(value: string): value is PlanKey {
  return value in PLANS;
}

async function loadAuthLastSignIn(
  admin: NonNullable<ReturnType<typeof tryCreateAdminClient>>
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const users = data.users ?? [];
    for (const u of users) {
      map.set(u.id, u.last_sign_in_at ?? null);
    }
    if (users.length < perPage) break;
    page += 1;
    if (page > 50) break;
  }

  return map;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isSupportAdminEmail(user.email)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    return NextResponse.json({ error: SERVICE_ROLE_MISSING_MESSAGE }, { status: 503 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    workspacesRes,
    membersRes,
    profilesRes,
    subscriptionsRes,
    machinesRes,
    jobsRes,
    supportRes,
    errorsRes,
    npsRes,
    signInMap,
  ] = await Promise.all([
    admin.from("workspaces").select("id, name, ui_version").order("name"),
    admin.from("workspace_members").select("workspace_id, user_id"),
    admin.from("profiles").select("id, email"),
    admin.from("subscriptions").select("user_id, plan_key, status"),
    admin.from("machines").select("user_id, connection_status"),
    admin.from("jobs").select("user_id, created_at").gte("created_at", thirtyDaysAgo),
    admin
      .from("support_reports")
      .select("user_id, status")
      .in("status", ["open", "in_progress"]),
    admin
      .from("client_error_events")
      .select("user_id, count, last_seen")
      .gte("last_seen", sevenDaysAgo),
    admin
      .from("feedback_responses")
      .select("workspace_id, score, created_at")
      .eq("kind", "nps")
      .order("created_at", { ascending: false }),
    loadAuthLastSignIn(admin),
  ]);

  if (workspacesRes.error) {
    return NextResponse.json({ error: workspacesRes.error.message }, { status: 500 });
  }

  const workspaces = (workspacesRes.data ?? []) as WorkspaceRow[];
  const members = (membersRes.data ?? []) as MemberRow[];
  const profiles = new Map(
    ((profilesRes.data ?? []) as ProfileRow[]).map((p) => [p.id, p.email])
  );
  const subscriptions = new Map(
    ((subscriptionsRes.data ?? []) as SubscriptionRow[]).map((s) => [s.user_id, s])
  );

  const membersByWorkspace = new Map<string, Set<string>>();
  const workspacesByUser = new Map<string, string[]>();
  for (const m of members) {
    const set = membersByWorkspace.get(m.workspace_id) ?? new Set<string>();
    set.add(m.user_id);
    membersByWorkspace.set(m.workspace_id, set);

    const list = workspacesByUser.get(m.user_id) ?? [];
    list.push(m.workspace_id);
    workspacesByUser.set(m.user_id, list);
  }

  const connectedByTenant = new Map<string, number>();
  const totalMachinesByTenant = new Map<string, number>();
  for (const machine of (machinesRes.data ?? []) as MachineRow[]) {
    const tid = machine.user_id;
    totalMachinesByTenant.set(tid, (totalMachinesByTenant.get(tid) ?? 0) + 1);
    if (machine.connection_status === "connected") {
      connectedByTenant.set(tid, (connectedByTenant.get(tid) ?? 0) + 1);
    }
  }

  const orders7 = new Map<string, number>();
  const orders30 = new Map<string, number>();
  for (const job of (jobsRes.data ?? []) as JobRow[]) {
    orders30.set(job.user_id, (orders30.get(job.user_id) ?? 0) + 1);
    if (job.created_at >= sevenDaysAgo) {
      orders7.set(job.user_id, (orders7.get(job.user_id) ?? 0) + 1);
    }
  }

  const openTickets = new Map<string, number>();
  for (const report of (supportRes.data ?? []) as SupportRow[]) {
    openTickets.set(report.user_id, (openTickets.get(report.user_id) ?? 0) + 1);
  }

  const errors7d = new Map<string, number>();
  for (const err of (errorsRes.data ?? []) as ErrorRow[]) {
    if (!err.user_id) continue;
    const wsIds = workspacesByUser.get(err.user_id) ?? [];
    for (const wsId of wsIds) {
      errors7d.set(wsId, (errors7d.get(wsId) ?? 0) + (err.count ?? 1));
    }
  }

  const latestNps = new Map<string, NpsRow>();
  for (const row of (npsRes.data ?? []) as NpsRow[]) {
    if (!row.workspace_id || latestNps.has(row.workspace_id)) continue;
    latestNps.set(row.workspace_id, row);
  }

  const tenants: TenantHealthRow[] = workspaces.map((ws) => {
    const memberIds = membersByWorkspace.get(ws.id) ?? new Set([ws.id]);
    let lastSignInAt: string | null = null;
    for (const uid of memberIds) {
      const signIn = signInMap.get(uid);
      if (!signIn) continue;
      if (!lastSignInAt || signIn > lastSignInAt) {
        lastSignInAt = signIn;
      }
    }

    const sub = subscriptions.get(ws.id);
    const planKey: PlanKey =
      sub && isPlanKey(sub.plan_key) ? sub.plan_key : "free";
    const nps = latestNps.get(ws.id);

    const health = computeHealthScore({
      lastSignInAt,
      connectedMachineCount: connectedByTenant.get(ws.id) ?? 0,
      totalMachineCount: totalMachinesByTenant.get(ws.id) ?? 0,
      ordersLast7Days: orders7.get(ws.id) ?? 0,
      ordersLast30Days: orders30.get(ws.id) ?? 0,
      clientErrorCount7d: errors7d.get(ws.id) ?? 0,
      openSupportTickets: openTickets.get(ws.id) ?? 0,
      planKey,
      subscriptionStatus: sub?.status ?? null,
      lastNpsScore: nps?.score ?? null,
      now,
    });

    return {
      workspaceId: ws.id,
      name: ws.name,
      ownerEmail: profiles.get(ws.id) ?? null,
      lastSignInAt,
      connectedMachineCount: connectedByTenant.get(ws.id) ?? 0,
      totalMachineCount: totalMachinesByTenant.get(ws.id) ?? 0,
      ordersLast7Days: orders7.get(ws.id) ?? 0,
      ordersLast30Days: orders30.get(ws.id) ?? 0,
      clientErrorCount7d: errors7d.get(ws.id) ?? 0,
      openSupportTickets: openTickets.get(ws.id) ?? 0,
      planKey,
      subscriptionStatus: sub?.status ?? null,
      lastNpsScore: nps?.score ?? null,
      lastNpsAt: nps?.created_at ?? null,
      uiVersion: ws.ui_version,
      score: health.score,
      band: health.band,
      factors: health.factors,
    };
  });

  tenants.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, "tr"));

  return NextResponse.json({ tenants, generatedAt: now.toISOString() });
}
