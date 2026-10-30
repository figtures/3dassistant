import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const MACHINE_FIELDS =
  "id, name, printer_state, connection_status, progress_percent, job_name, print_time_seconds, error_message, bed_temp_c, nozzle_temp_c, chamber_temp_c, camera_stream_url, telemetry_updated_at, last_seen_at";

/** SSE: makine canlı telemetri (2 sn). */
export async function GET(request: Request, context: RouteContext) {
  const { id: machineId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Oturum gerekli", { status: 401 });
  }

  const encoder = new TextEncoder();
  let lastPayload = "";
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
    async start(controller) {
      controllerRef = controller;

      const send = (payload: object) => {
        if (closed || request.signal.aborted) return;
        if (controller.desiredSize === null) {
          closed = true;
          return;
        }
        try {
          const line = `data: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(encoder.encode(line));
        } catch {
          closed = true;
          if (interval !== undefined) clearInterval(interval);
        }
      };

      const tick = async (): Promise<boolean> => {
        if (closed || request.signal.aborted) return false;
        try {
          const { data } = await supabase
            .from("machines")
            .select(MACHINE_FIELDS)
            .eq("id", machineId)
            .eq("user_id", user.id)
            .maybeSingle();
          if (closed || request.signal.aborted) return false;
          if (!data) {
            send({ type: "error", message: "Makine bulunamadı" });
            return false;
          }
          const json = JSON.stringify(data);
          if (json !== lastPayload) {
            lastPayload = json;
            send({ type: "snapshot", machine: data });
          } else {
            send({ type: "heartbeat", at: new Date().toISOString() });
          }
          return true;
        } catch {
          if (!closed && !request.signal.aborted) safeClose();
          return false;
        }
      };

      const runTick = () => {
        void tick().catch(() => {
          if (!closed) safeClose();
        });
      };

      send({ type: "connected", machineId });
      const ok = await tick();
      if (!ok) {
        safeClose();
        return;
      }

      interval = setInterval(() => {
        if (closed || request.signal.aborted) {
          safeClose();
          return;
        }
        runTick();
      }, 2000);

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
