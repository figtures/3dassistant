import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteOnboardingSampleData,
  insertOnboardingSampleData,
  userHasSampleData,
} from "@/lib/sample-data";
import {
  getEntitlements,
  machineLimitMessage,
  PLAN_ERROR,
} from "@/lib/billing/entitlements";
import { requireWorkspaceSession } from "@/lib/workspace/active";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const session = await requireWorkspaceSession();
  if (!session.ok) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const { workspaceId } = session;

  try {
    const already = await userHasSampleData(supabase, workspaceId);
    if (already) {
      return NextResponse.json({ ok: true, alreadyExists: true });
    }

    const result = await insertOnboardingSampleData(supabase, workspaceId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Örnek veri eklenemedi";
    if (message === "PLAN_MACHINE_LIMIT") {
      const entitlements = await getEntitlements(supabase, workspaceId);
      return NextResponse.json(
        {
          error: machineLimitMessage(entitlements.maxMachines),
          code: PLAN_ERROR.machineLimit,
        },
        { status: 402 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const supabase = await createClient();
  const session = await requireWorkspaceSession();
  if (!session.ok) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const { workspaceId } = session;

  try {
    const deleted = await deleteOnboardingSampleData(supabase, workspaceId);
    return NextResponse.json({ ok: true, ...deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Örnek veriler silinemedi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
