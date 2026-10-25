import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchTelemetryHistory } from "@/lib/printer-monitoring/telemetry-history";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: machineId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const hours = Math.min(168, Math.max(1, Number(request.nextUrl.searchParams.get("hours") || 24)));

  const { data: machine } = await supabase
    .from("machines")
    .select("id")
    .eq("id", machineId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!machine) {
    return NextResponse.json({ error: "Makine bulunamadı" }, { status: 404 });
  }

  try {
    const snapshots = await fetchTelemetryHistory(supabase, machineId, user.id, hours);
    return NextResponse.json({ snapshots, hours });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Geçmiş yüklenemedi" },
      { status: 500 }
    );
  }
}
