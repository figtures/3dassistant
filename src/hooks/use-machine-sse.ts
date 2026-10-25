"use client";

import { useEffect, useState } from "react";
import type { Machine } from "@/types/database";

type LiveMachine = Pick<
  Machine,
  | "id"
  | "name"
  | "printer_state"
  | "connection_status"
  | "progress_percent"
  | "job_name"
  | "print_time_seconds"
  | "error_message"
  | "bed_temp_c"
  | "nozzle_temp_c"
  | "chamber_temp_c"
  | "camera_stream_url"
  | "telemetry_updated_at"
  | "last_seen_at"
>;

export function useMachineLiveSse(machineId: string | undefined) {
  const [live, setLive] = useState<LiveMachine | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!machineId) return;
    const es = new EventSource(`/api/machines/${machineId}/live`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "snapshot" && msg.machine) {
          setLive(msg.machine as LiveMachine);
        }
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [machineId]);

  return { live, sseConnected: connected };
}

export function useFleetLiveSse(enabled = true) {
  const [machines, setMachines] = useState<LiveMachine[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource("/api/machines/live");
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "fleet" && Array.isArray(msg.machines)) {
          setMachines(msg.machines as LiveMachine[]);
        }
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [enabled]);

  return machines;
}
