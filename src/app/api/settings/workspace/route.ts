import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceSession } from "@/lib/workspace/active";
import { isWorkspaceAdminRole } from "@/lib/workspace/roles";
import {
  mergeWorkspaceBillingMeta,
  readWorkspaceBillingMeta,
} from "@/lib/settings/workspace-billing-meta";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireWorkspaceSession();
  if (!session.ok) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: session.status });
  }

  const supabase = await createClient();
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", session.workspaceId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const admin = createAdminClient();
  const { data: ownerAuth, error: ownerError } =
    await admin.auth.admin.getUserById(session.workspaceId);

  if (ownerError) {
    return NextResponse.json({ error: ownerError.message }, { status: 500 });
  }

  const billing = readWorkspaceBillingMeta(
    ownerAuth.user?.user_metadata as Record<string, unknown> | undefined
  );

  return NextResponse.json({
    name: workspace?.name?.trim() || "Atölyem",
    taxNumber: billing.taxNumber ?? "",
    billingAddress: billing.billingAddress ?? "",
    timezone: billing.timezone ?? "Europe/Istanbul",
    currency: "TRY",
    canEdit: isWorkspaceAdminRole(session.role),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await requireWorkspaceSession();
  if (!session.ok) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: session.status });
  }

  if (!isWorkspaceAdminRole(session.role)) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    taxNumber?: string;
    billingAddress?: string;
    timezone?: string;
  };

  const supabase = await createClient();

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Firma adı boş olamaz" }, { status: 400 });
    }
    const { error } = await supabase
      .from("workspaces")
      .update({ name })
      .eq("id", session.workspaceId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const admin = createAdminClient();
  const { data: ownerAuth, error: ownerError } =
    await admin.auth.admin.getUserById(session.workspaceId);

  if (ownerError || !ownerAuth.user) {
    return NextResponse.json(
      { error: ownerError?.message ?? "Çalışma alanı sahibi bulunamadı" },
      { status: 500 }
    );
  }

  const merged = mergeWorkspaceBillingMeta(
    ownerAuth.user.user_metadata as Record<string, unknown> | undefined,
    {
      taxNumber:
        typeof body.taxNumber === "string" ? body.taxNumber.trim() : undefined,
      billingAddress:
        typeof body.billingAddress === "string"
          ? body.billingAddress.trim()
          : undefined,
      timezone:
        typeof body.timezone === "string" ? body.timezone.trim() : undefined,
    }
  );

  const { error: metaError } = await admin.auth.admin.updateUserById(
    session.workspaceId,
    { user_metadata: merged }
  );

  if (metaError) {
    return NextResponse.json({ error: metaError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
