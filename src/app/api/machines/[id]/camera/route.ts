import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** Oturumlu kullanıcı: köprünün push ettiği son kamera karesi. */
export async function GET(_request: Request, context: RouteContext) {
  const { id: machineId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Oturum gerekli", { status: 401 });
  }

  const { data: machine } = await supabase
    .from("machines")
    .select("id")
    .eq("id", machineId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!machine) {
    return new Response("Makine bulunamadı", { status: 404 });
  }

  const admin = createAdminClient();
  const { data: frame } = await admin
    .from("machine_camera_frames")
    .select("content_type, frame_data, captured_at")
    .eq("machine_id", machineId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!frame?.frame_data) {
    return new Response("Henüz kamera karesi yok — köprü çalışıyor olmalı", { status: 404 });
  }

  const raw = frame.frame_data;
  let bytes: Uint8Array;
  if (raw instanceof Uint8Array) {
    bytes = raw;
  } else if (typeof raw === "string") {
    bytes = raw.startsWith("\\x")
      ? new Uint8Array(Buffer.from(raw.slice(2), "hex"))
      : new Uint8Array(Buffer.from(raw, "base64"));
  } else {
    bytes = new Uint8Array(Buffer.from(raw as ArrayBuffer));
  }

  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": frame.content_type || "image/jpeg",
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
      "X-Captured-At": frame.captured_at ?? "",
    },
  });
}
