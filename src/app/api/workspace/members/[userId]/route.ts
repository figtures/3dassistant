import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceSession } from "@/lib/workspace/active";
import { isWorkspaceAdminRole } from "@/lib/workspace/roles";
import {
  canRemoveMember,
  canUpdateMemberRole,
  type MemberSnapshot,
} from "@/lib/workspace/member-rules";
import { WORKSPACE_ROLES, type WorkspaceRole } from "@/types/database";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ userId: string }> };

async function loadMembers(workspaceId: string): Promise<MemberSnapshot[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspaceId);
  return (data ?? []).map((r) => ({ userId: r.user_id, role: r.role as WorkspaceRole }));
}

function parseRole(value: unknown): WorkspaceRole | null {
  if (typeof value !== "string") return null;
  return (WORKSPACE_ROLES as readonly string[]).includes(value)
    ? (value as WorkspaceRole)
    : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireWorkspaceSession();
  if (!session.ok) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (!isWorkspaceAdminRole(session.role)) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const { userId } = await context.params;
  const targetId = userId?.trim();
  if (!targetId) {
    return NextResponse.json({ error: "Kullanıcı gerekli" }, { status: 400 });
  }

  let body: { role?: string };
  try {
    body = (await request.json()) as { role?: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const newRole = parseRole(body.role);
  if (!newRole) {
    return NextResponse.json({ error: "Geçersiz rol" }, { status: 400 });
  }

  const members = await loadMembers(session.workspaceId);
  const target = members.find((m) => m.userId === targetId);
  if (!target) {
    return NextResponse.json({ error: "Üye bulunamadı" }, { status: 404 });
  }

  const check = canUpdateMemberRole(session.role, target, newRole);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .update({ role: newRole })
    .eq("workspace_id", session.workspaceId)
    .eq("user_id", targetId);

  if (error) {
    console.error("[workspace/members PATCH]", error);
    return NextResponse.json({ error: "Rol güncellenemedi" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: targetId, role: newRole });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireWorkspaceSession();
  if (!session.ok) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (!isWorkspaceAdminRole(session.role)) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const { userId } = await context.params;
  const targetId = userId?.trim();
  if (!targetId) {
    return NextResponse.json({ error: "Kullanıcı gerekli" }, { status: 400 });
  }

  const members = await loadMembers(session.workspaceId);
  const target = members.find((m) => m.userId === targetId);
  if (!target) {
    return NextResponse.json({ error: "Üye bulunamadı" }, { status: 404 });
  }

  const check = canRemoveMember(session.authUserId, session.role, target, members);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", session.workspaceId)
    .eq("user_id", targetId);

  if (error) {
    console.error("[workspace/members DELETE]", error);
    return NextResponse.json({ error: "Üye çıkarılamadı" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: targetId });
}
