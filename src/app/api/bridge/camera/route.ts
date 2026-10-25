import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bridgeFromBearer } from "@/lib/bridge/auth";
import {
  bridgeCameraUploadToBuffer,
  parseBridgeCameraUpload,
} from "@/lib/bridge/camera";

export const dynamic = "force-dynamic";

/** Köprü ajanı: LAN kamera JPEG karesini buluta yükler. */
export async function POST(request: NextRequest) {
  const ctx = await bridgeFromBearer(request.headers.get("authorization"));
  if (!ctx) {
    return NextResponse.json({ error: "Geçersiz köprü jetonu" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const upload = parseBridgeCameraUpload(body);
  if (!upload) {
    return NextResponse.json({ error: "machineId ve imageBase64 geçersiz" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: binding } = await admin
    .from("bridge_machine_bindings")
    .select("id, machine_id")
    .eq("bridge_id", ctx.bridgeId)
    .eq("machine_id", upload.machineId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!binding) {
    return NextResponse.json({ error: "Bu makine bu köprüye bağlı değil" }, { status: 403 });
  }

  const frameData = bridgeCameraUploadToBuffer(upload);
  const now = new Date().toISOString();

  const { error } = await admin.from("machine_camera_frames").upsert(
    {
      machine_id: upload.machineId,
      user_id: ctx.userId,
      content_type: upload.contentType,
      frame_data: frameData,
      captured_at: now,
      updated_at: now,
    },
    { onConflict: "machine_id" }
  );

  if (error) {
    return NextResponse.json({ error: "Kare kaydedilemedi" }, { status: 500 });
  }

  await admin.from("workshop_bridges").update({ last_seen_at: now }).eq("id", ctx.bridgeId);

  return NextResponse.json({ ok: true, capturedAt: now });
}
