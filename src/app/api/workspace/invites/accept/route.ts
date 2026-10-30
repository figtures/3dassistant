import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/get-auth-user";
import {
  inviteEmailMatchError,
  inviteExpiryError,
} from "@/lib/workspace/member-rules";
import { hashInviteToken } from "@/lib/workspace/invites";
import type { WorkspaceRole } from "@/types/database";

export const dynamic = "force-dynamic";

/** Davet kabulü (oturum açık; e-posta davet ile eşleşmeli). */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Daveti kabul etmek için giriş yapın" }, { status: 401 });
  }

  let body: { token?: string };
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "Davet bağlantısı geçersiz" }, { status: 400 });
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik; davet kabul edilemiyor" },
      { status: 503 }
    );
  }

  const tokenHash = hashInviteToken(token);
  const { data: invite, error: findErr } = await admin
    .from("workspace_invites")
    .select("id, workspace_id, email, role, expires_at, accepted_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (findErr) {
    console.error("[workspace/invites/accept]", findErr);
    return NextResponse.json({ error: "Davet doğrulanamadı" }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json({ error: "Davet bulunamadı veya geçersiz" }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: "Bu davet zaten kullanılmış" }, { status: 400 });
  }

  const expiry = inviteExpiryError(invite.expires_at);
  if (!expiry.ok) {
    return NextResponse.json({ error: expiry.reason }, { status: 410 });
  }

  const emailCheck = inviteEmailMatchError(invite.email, user.email);
  if (!emailCheck.ok) {
    return NextResponse.json({ error: emailCheck.reason }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await admin
      .from("workspace_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
    return NextResponse.json({
      ok: true,
      alreadyMember: true,
      workspaceId: invite.workspace_id,
    });
  }

  const role = invite.role as WorkspaceRole;
  const { error: memberErr } = await admin.from("workspace_members").insert({
    workspace_id: invite.workspace_id,
    user_id: user.id,
    role,
  });

  if (memberErr) {
    console.error("[workspace/invites/accept] insert member", memberErr);
    return NextResponse.json({ error: "Üyelik oluşturulamadı" }, { status: 500 });
  }

  const { error: acceptErr } = await admin
    .from("workspace_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  if (acceptErr) {
    console.error("[workspace/invites/accept] mark accepted", acceptErr);
  }

  return NextResponse.json({
    ok: true,
    workspaceId: invite.workspace_id,
    role,
  });
}

/** Davet önizleme (herkese açık meta). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "token gerekli" }, { status: 400 });
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Sunucu yapılandırması eksik" }, { status: 503 });
  }

  const tokenHash = hashInviteToken(token);
  const { data: invite, error } = await admin
    .from("workspace_invites")
    .select("email, role, expires_at, accepted_at, workspace:workspaces(name)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("[workspace/invites/accept GET]", error);
    return NextResponse.json({ error: "Davet yüklenemedi" }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json({ error: "Davet bulunamadı" }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: "Bu davet zaten kullanılmış" }, { status: 400 });
  }

  const expiry = inviteExpiryError(invite.expires_at);
  if (!expiry.ok) {
    return NextResponse.json({ error: expiry.reason }, { status: 410 });
  }

  const wsRaw = invite.workspace as { name: string } | { name: string }[] | null;
  const ws = Array.isArray(wsRaw) ? wsRaw[0] : wsRaw;

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expires_at,
    workspaceName: ws?.name ?? "Atölyem",
  });
}
