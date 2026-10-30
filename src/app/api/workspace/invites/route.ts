import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { requireWorkspaceSession, loadWorkspaceSession } from "@/lib/workspace/active";
import { buildWorkspaceInviteEmail } from "@/lib/workspace/invite-email";
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiresAt,
} from "@/lib/workspace/invites";
import { canInviteWithRole } from "@/lib/workspace/member-rules";
import { isWorkspaceAdminRole } from "@/lib/workspace/roles";
import type { WorkspaceRole } from "@/types/database";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function siteBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export async function GET() {
  const session = await requireWorkspaceSession();
  if (!session.ok) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: invites, error } = await supabase
    .from("workspace_invites")
    .select("id, email, role, expires_at, accepted_at, invited_by")
    .eq("workspace_id", session.workspaceId)
    .is("accepted_at", null)
    .order("expires_at", { ascending: true });

  if (error) {
    console.error("[workspace/invites GET]", error);
    return NextResponse.json({ error: "Davetler yüklenemedi" }, { status: 500 });
  }

  return NextResponse.json({
    invites: invites ?? [],
    canManage: isWorkspaceAdminRole(session.role),
  });
}

export async function POST(request: Request) {
  const session = await requireWorkspaceSession();
  if (!session.ok) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (!isWorkspaceAdminRole(session.role)) {
    return NextResponse.json({ error: "Davet göndermek için yetkiniz yok" }, { status: 403 });
  }

  let body: { email?: string; role?: string };
  try {
    body = (await request.json()) as { email?: string; role?: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const role = body.role?.trim() as WorkspaceRole | undefined;

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Geçerli bir e-posta girin" }, { status: 400 });
  }
  if (!role) {
    return NextResponse.json({ error: "Rol seçin" }, { status: 400 });
  }

  const roleCheck = canInviteWithRole(role);
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.reason }, { status: 400 });
  }

  const wsSession = await loadWorkspaceSession();
  const workspaceName = wsSession?.name ?? "Atölyem";

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = inviteExpiresAt();

  const supabase = await createClient();

  await supabase
    .from("workspace_invites")
    .delete()
    .eq("workspace_id", session.workspaceId)
    .eq("email", email)
    .is("accepted_at", null);

  const { data: invite, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: session.workspaceId,
      email,
      role,
      token_hash: tokenHash,
      invited_by: session.authUserId,
      expires_at: expiresAt,
    })
    .select("id, email, role, expires_at")
    .single();

  if (error) {
    console.error("[workspace/invites POST]", error);
    return NextResponse.json({ error: "Davet oluşturulamadı" }, { status: 500 });
  }

  const acceptUrl = `${siteBase()}/invite/${encodeURIComponent(token)}`;
  const mail = buildWorkspaceInviteEmail({
    workspaceName,
    role,
    acceptUrl,
    expiresAt,
  });

  await sendEmail({
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });

  return NextResponse.json({ ok: true, invite, acceptUrl });
}

export async function DELETE(request: Request) {
  const session = await requireWorkspaceSession();
  if (!session.ok) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (!isWorkspaceAdminRole(session.role)) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  let body: { inviteId?: string };
  try {
    body = (await request.json()) as { inviteId?: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const inviteId = body.inviteId?.trim();
  if (!inviteId) {
    return NextResponse.json({ error: "inviteId gerekli" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_invites")
    .delete()
    .eq("id", inviteId)
    .eq("workspace_id", session.workspaceId)
    .is("accepted_at", null);

  if (error) {
    console.error("[workspace/invites DELETE]", error);
    return NextResponse.json({ error: "Davet iptal edilemedi" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
