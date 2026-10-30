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
  let closed = false;
  let interval: ReturnType<typeof setInterval> | undefined;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined;

  const safeClose = () => {
    if (closed) return;
    closed = true;
    if (interval !== undefined) clearInterval(interval);
    try {
      controllerRef?.close();
    } catch {
      // stream zaten kapanmış olabilir
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;

      const send = (payload: object) => {
        if (closed || request.signal.aborted) return;
        if (controller.desiredSize === null) {
          closed = true;
          return;
        }
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          closed = true;
          if (interval !== undefined) clearInterval(interval);
        }
      };

      const tick = async () => {
        if (closed || request.signal.aborted) return;
        try {
          const { data } = await supabase
            .from("machines")
            .select(MACHINE_FIELDS)
            .eq("user_id", user.id)
            .order("sort_order");
          if (closed || request.signal.aborted) return;
          send({
            type: "fleet",
            machines: data ?? [],
            at: new Date().toISOString(),
          });
        } catch {
          if (!closed && !request.signal.aborted) safeClose();
        }
      };

      const runTick = () => {
        void tick().catch(() => {
          if (!closed) safeClose();
        });
      };

      runTick();
      interval = setInterval(() => {
        if (closed || request.signal.aborted) {
          safeClose();
          return;
        }
        runTick();
      }, 3000);

      request.signal.addEventListener("abort", safeClose, { once: true });
    },
    cancel() {
      safeClose();
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
