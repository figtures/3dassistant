import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MACHINE_FIELDS =
  "id, name, printer_state, connection_status, progress_percent, job_name, bed_temp_c, nozzle_temp_c, chamber_temp_c, camera_stream_url, telemetry_updated_at";

/** SSE: tüm makineler (dashboard filo, 3 sn). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Oturum gerekli", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const tick = async () => {
        const { data } = await supabase
          .from("machines")
          .select(MACHINE_FIELDS)
          .eq("user_id", user.id)
          .order("sort_order");
        send({ type: "fleet", machines: data ?? [], at: new Date().toISOString() });
      };

      tick();
      const interval = setInterval(() => {
        if (request.signal.aborted) {
          clearInterval(interval);
          controller.close();
          return;
        }
        tick();
      }, 3000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
