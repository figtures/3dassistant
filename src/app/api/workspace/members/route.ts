import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceSession } from "@/lib/workspace/active";
import { isWorkspaceAdminRole } from "@/lib/workspace/roles";

export const dynamic = "force-dynamic";

export type WorkspaceMemberDto = {
  userId: string;
  role: string;
  createdAt: string;
  email: string | null;
  fullName: string | null;
};

/** Aktif çalışma alanı üyeleri (profil bilgisiyle). */
export async function GET() {
  const session = await requireWorkspaceSession();
  if (!session.ok) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, created_at")
    .eq("workspace_id", session.workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[workspace/members]", error);
    return NextResponse.json({ error: "Üyeler yüklenemedi" }, { status: 500 });
  }

  const userIds = (rows ?? []).map((r) => r.user_id);
  const profileMap = new Map<string, { email: string | null; full_name: string | null }>();

  const admin = tryCreateAdminClient();
  if (admin && userIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { email: p.email, full_name: p.full_name });
    }
  }

  const members: WorkspaceMemberDto[] = (rows ?? []).map((row) => {
    const profile = profileMap.get(row.user_id);
    return {
      userId: row.user_id,
      role: row.role,
      createdAt: row.created_at,
      email: profile?.email ?? null,
      fullName: profile?.full_name ?? null,
    };
  });

  return NextResponse.json({
    members,
    workspaceId: session.workspaceId,
    role: session.role,
    canManage: isWorkspaceAdminRole(session.role),
  });
}
